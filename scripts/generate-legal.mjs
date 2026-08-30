import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(new URL('./', new URL(path, root)), { recursive: true });
  await writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const packageJson = await readJson('package.json');
const lock = await readJson('package-lock.json');
const policy = await readJson('third_party/policy.json');
const reviewed = await readJson('third_party/reviewed-components.json');
const apacheLicense = await readFile(new URL('legal/apache-2.0.txt', root), 'utf8');

const reviewedById = new Map(
  reviewed.components.map((component) => [`${component.name}@${component.version}`, component]),
);
const allowed = new Set(policy.allowedLicenseIds);
const lockPackages = new Map(Object.entries(lock.packages ?? {}));

function packageNameFromPath(packagePath) {
  const marker = 'node_modules/';
  const index = packagePath.lastIndexOf(marker);
  if (index < 0) throw new Error(`cannot derive package name from ${packagePath}`);
  return packagePath.slice(index + marker.length);
}

function assertKnownLicense(name, expression) {
  if (typeof expression !== 'string' || expression.trim() === '') {
    throw new Error(`unknown license for ${name}`);
  }
}

function licenseAtoms(expression) {
  if (typeof expression !== 'string' || expression.trim() === '') return [];
  if (/\bWITH\b/.test(expression)) return [];
  return expression
    .replace(/[()]/g, ' ')
    .split(/\s+(?:AND|OR)\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function assertDistributionAllowed(name, expression) {
  const atoms = licenseAtoms(expression);
  if (atoms.length === 0 || atoms.some((atom) => !allowed.has(atom))) {
    throw new Error(`unapproved distributed license for ${name}: ${expression ?? 'missing'}`);
  }
}

function resolveDependencyPath(parentPath, dependencyName) {
  const candidates = [];
  if (parentPath) candidates.push(`${parentPath}/node_modules/${dependencyName}`);
  let cursor = parentPath;
  while (cursor.includes('/node_modules/')) {
    cursor = cursor.slice(0, cursor.lastIndexOf('/node_modules/'));
    candidates.push(`${cursor}/node_modules/${dependencyName}`);
  }
  candidates.push(`node_modules/${dependencyName}`);
  return candidates.find((candidate) => lockPackages.has(candidate)) ?? null;
}

const rawRecords = [...lockPackages.entries()]
  .filter(([packagePath, value]) => packagePath.startsWith('node_modules/') && value?.version)
  .map(([packagePath, value]) => {
    const name = packageNameFromPath(packagePath);
    const id = `${name}@${value.version}`;
    const review = reviewedById.get(id) ?? null;
    const lockLicenseExpression = value.license ?? null;
    const licenseExpression = review?.licenseExpression ?? lockLicenseExpression;
    assertKnownLicense(id, licenseExpression);
    if (review && lockLicenseExpression && review.licenseExpression !== lockLicenseExpression) {
      assertKnownLicense(id, lockLicenseExpression);
    }
    const dependencyNames = Object.keys({
      ...(value.dependencies ?? {}),
      ...(value.optionalDependencies ?? {}),
    });
    return {
      packagePath,
      name,
      version: value.version,
      id,
      review,
      licenseExpression,
      lockLicenseExpression,
      resolved: value.resolved ?? null,
      integrity: value.integrity ?? null,
      dependencyPaths: dependencyNames
        .map((dependencyName) => resolveDependencyPath(packagePath, dependencyName))
        .filter(Boolean),
    };
  });

const recordsByPath = new Map(rawRecords.map((record) => [record.packagePath, record]));
const runtimeRoots = Object.keys({
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.optionalDependencies ?? {}),
})
  .map((name) => resolveDependencyPath('', name))
  .filter(Boolean);
const developmentRoots = Object.keys(packageJson.devDependencies ?? {})
  .map((name) => resolveDependencyPath('', name))
  .filter(Boolean);

function reachableFrom(roots) {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const record = recordsByPath.get(current);
    if (record) queue.push(...record.dependencyPaths);
  }
  return seen;
}

const runtimeReachable = reachableFrom(runtimeRoots);
const developmentReachable = reachableFrom(developmentRoots);

function usageFor(record) {
  if (runtimeReachable.has(record.packagePath)) return 'runtime-distributed';
  if (record.review?.usage) return record.review.usage;
  if (developmentReachable.has(record.packagePath)) return 'build-only';
  return 'build-only';
}

function toPurl(name, version) {
  if (name.startsWith('@')) {
    const [scope, packageName] = name.slice(1).split('/');
    return `pkg:npm/%40${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}@${encodeURIComponent(version)}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

async function readPackageLegalFile(packagePath, matcher) {
  const directory = new URL(`${packagePath}/`, root);
  let names;
  try {
    names = await readdir(directory);
  } catch {
    return null;
  }
  const candidate = names.sort().find((name) => matcher.test(name));
  if (!candidate) return null;
  return {
    name: candidate,
    text: await readFile(new URL(candidate, directory), 'utf8'),
  };
}

const provenancePackages = [];
const runtimeLegal = [];
for (const record of rawRecords.sort(
  (a, b) => a.id.localeCompare(b.id) || a.packagePath.localeCompare(b.packagePath),
)) {
  const usage = usageFor(record);
  if (usage === 'runtime-distributed') {
    assertDistributionAllowed(record.id, record.licenseExpression);
    if (record.lockLicenseExpression && record.lockLicenseExpression !== record.licenseExpression) {
      assertDistributionAllowed(record.id, record.lockLicenseExpression);
    }
    if (policy.runtimeRequiresExplicitReview && record.review?.reviewStatus !== 'reviewed') {
      throw new Error(`runtime component lacks explicit review: ${record.id}`);
    }
  }
  const sourceUrl =
    record.review?.sourceUrl ??
    record.resolved ??
    `https://www.npmjs.com/package/${encodeURIComponent(record.name)}/v/${record.version}`;
  let licenseFile = null;
  let noticeFile = null;
  if (usage === 'runtime-distributed') {
    licenseFile = await readPackageLegalFile(
      record.packagePath,
      /^(LICENSE|LICENCE|COPYING)([._-].*)?$/i,
    );
    if (!licenseFile) {
      throw new Error(`runtime component lacks redistributable license text: ${record.id}`);
    }
    if (record.review?.requiresNotice) {
      noticeFile = await readPackageLegalFile(record.packagePath, /^NOTICE([._-].*)?$/i);
      if (!noticeFile) {
        throw new Error(`runtime component requires NOTICE but none was found: ${record.id}`);
      }
    }
    runtimeLegal.push({ record, sourceUrl, licenseFile, noticeFile });
  }
  provenancePackages.push({
    component: record.name,
    packageIdentity: `npm:${record.name}@${record.version}`,
    version: record.version,
    packagePath: record.packagePath,
    sourceUrl,
    integrity: record.integrity,
    licenseExpression: record.licenseExpression,
    copyrightAttribution: record.review?.copyrightAttribution ?? null,
    usage,
    incorporation: record.review?.incorporation ?? 'dependency',
    modifications: record.review?.modifications ?? 'none',
    obligations: {
      licenseText: usage === 'runtime-distributed',
      notice: Boolean(record.review?.requiresNotice),
      attribution: Boolean(record.review?.copyrightAttribution),
    },
    reviewStatus: record.review?.reviewStatus ?? 'policy-pass',
    reviewer: record.review?.reviewer ?? policy.automatedReviewer,
    reviewDate: record.review?.reviewDate ?? policy.policyReviewDate,
  });
}

const provenance = {
  schemaVersion: 1,
  policyId: policy.policyId,
  generatedFrom: 'package-lock.json + third_party/reviewed-components.json',
  packages: provenancePackages,
};
await writeJson('third_party/provenance.json', provenance);

const licenseDir = new URL('third_party/licenses/', root);
await rm(licenseDir, { recursive: true, force: true });
await mkdir(licenseDir, { recursive: true });
await writeFile(
  new URL('README.md', licenseDir),
  '# Third-party license bundle\n\nGenerated by `scripts/generate-legal.mjs`. Runtime-distributed third-party license texts are emitted here from installed package contents. Build/test-only tools remain in provenance and the SBOM but are not shipped as runtime license entries.\n',
  'utf8',
);

const runtimeNoticeLines = [];
const thirdPartyLines = [
  '# Third-Party Notices',
  '',
  'Generated from `third_party/provenance.json` under the FI-6 policy.',
  '',
];
const offlineEntries = [];
for (const item of runtimeLegal) {
  const safeName = item.record.name
    .replace(/^@/, '')
    .replaceAll('/', '__')
    .replaceAll(/[^a-zA-Z0-9_.-]/g, '_');
  const licensePath = `${safeName}-${item.record.version}.txt`;
  await writeFile(new URL(licensePath, licenseDir), item.licenseFile.text, 'utf8');
  thirdPartyLines.push(`## ${item.record.name} ${item.record.version}`);
  thirdPartyLines.push('');
  thirdPartyLines.push(`- Source: ${item.sourceUrl}`);
  thirdPartyLines.push(`- License: ${item.record.licenseExpression}`);
  thirdPartyLines.push(`- License text: third_party/licenses/${licensePath}`);
  if (item.record.review?.copyrightAttribution) {
    thirdPartyLines.push(`- Attribution: ${item.record.review.copyrightAttribution}`);
  }
  thirdPartyLines.push('');
  if (item.noticeFile) {
    runtimeNoticeLines.push(`---- ${item.record.name} ${item.record.version} ----`);
    runtimeNoticeLines.push(item.noticeFile.text.trim());
    runtimeNoticeLines.push('');
  }
  offlineEntries.push({
    name: item.record.name,
    version: item.record.version,
    sourceUrl: item.sourceUrl,
    licenseExpression: item.record.licenseExpression,
    attribution: item.record.review?.copyrightAttribution ?? null,
    licenseText: item.licenseFile.text,
    noticeText: item.noticeFile?.text ?? null,
  });
}
if (runtimeLegal.length === 0) {
  thirdPartyLines.push(
    'No third-party runtime components are distributed by the current application shell.',
  );
  thirdPartyLines.push(
    'Build/test tooling is recorded in `third_party/provenance.json` and `bom.cdx.json`.',
  );
  thirdPartyLines.push('');
}
await writeFile(
  new URL('THIRD_PARTY_NOTICES.md', root),
  `${thirdPartyLines.join('\n').trim()}\n`,
  'utf8',
);

const notice = [
  'Illustro',
  'Copyright 2026 Illustro contributors',
  '',
  'Licensed under the Apache License, Version 2.0.',
  'Third-party NOTICE attributions required by distributed components follow when applicable.',
  '',
  ...runtimeNoticeLines,
]
  .join('\n')
  .trimEnd();
await writeFile(new URL('NOTICE', root), `${notice}\n`, 'utf8');
await writeFile(new URL('LICENSE', root), apacheLicense, 'utf8');

const componentByIdentity = new Map();
for (const record of rawRecords) {
  const key = record.id;
  const usage = usageFor(record);
  const current = componentByIdentity.get(key) ?? {
    type: 'library',
    'bom-ref': toPurl(record.name, record.version),
    name: record.name,
    version: record.version,
    scope: usage === 'runtime-distributed' ? 'required' : 'excluded',
    licenses: [{ expression: record.licenseExpression }],
    purl: toPurl(record.name, record.version),
    properties: [
      { name: 'illustro:usage', value: usage },
      {
        name: 'illustro:review-status',
        value: record.review?.reviewStatus ?? 'policy-pass',
      },
    ],
  };
  componentByIdentity.set(key, current);
}
const componentRefs = new Map(
  [...componentByIdentity.entries()].map(([key, component]) => [key, component['bom-ref']]),
);
const pathToRef = new Map(
  rawRecords.map((record) => [record.packagePath, componentRefs.get(record.id)]),
);
const dependencyMap = new Map();
for (const record of rawRecords) {
  const ref = pathToRef.get(record.packagePath);
  if (!ref) continue;
  const existing = dependencyMap.get(ref) ?? new Set();
  for (const dependencyPath of record.dependencyPaths) {
    const dependencyRef = pathToRef.get(dependencyPath);
    if (dependencyRef && dependencyRef !== ref) existing.add(dependencyRef);
  }
  dependencyMap.set(ref, existing);
}
const appRef = toPurl(packageJson.name, packageJson.version);
const directRefs = [
  ...new Set(
    [...runtimeRoots, ...developmentRoots].map((path) => pathToRef.get(path)).filter(Boolean),
  ),
].sort();
const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.7',
  version: 1,
  metadata: {
    component: {
      type: 'application',
      'bom-ref': appRef,
      name: packageJson.name,
      version: packageJson.version,
      purl: appRef,
    },
    properties: [{ name: 'illustro:policy', value: policy.policyId }],
  },
  components: [...componentByIdentity.values()].sort((a, b) =>
    a['bom-ref'].localeCompare(b['bom-ref']),
  ),
  dependencies: [
    { ref: appRef, dependsOn: directRefs },
    ...[...dependencyMap.entries()]
      .map(([ref, dependsOn]) => ({ ref, dependsOn: [...dependsOn].sort() }))
      .sort((a, b) => a.ref.localeCompare(b.ref)),
  ],
};
await writeJson('bom.cdx.json', bom);

const offline = {
  schemaVersion: 1,
  generatedFrom: 'third_party/provenance.json',
  policyId: policy.policyId,
  components: offlineEntries.sort(
    (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
  ),
};
await writeJson('public/legal/open-source-licenses.json', offline);

console.log(
  JSON.stringify({
    event: 'legal.generated',
    packages: provenancePackages.length,
    runtimeDistributed: runtimeLegal.length,
    sbomSpecVersion: bom.specVersion,
  }),
);
