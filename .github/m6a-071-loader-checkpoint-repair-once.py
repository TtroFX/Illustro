from pathlib import Path
import runpy

runpy.run_path('.github/m6a-071-loader-checkpoint-once.py', run_name='__main__')

source_path = Path('src/app/builtin-sampled-resource-loader.ts')
source = source_path.read_text(encoding='utf-8')
source = source.replace(
    "if (!Number.isSafeInteger(byteLength) || (byteLength as number) <= 0) {",
    "if (typeof byteLength !== 'number' || !Number.isSafeInteger(byteLength) || byteLength <= 0) {",
    1,
)
source = source.replace("byteLength: byteLength as number,", "byteLength,", 1)
source_path.write_text(source, encoding='utf-8')

test_path = Path('tests/unit/builtin-sampled-resource-loader.test.ts')
test = test_path.read_text(encoding='utf-8')
test = test.replace(
    "    const target = resources.find((resource) => resource.alias === 'builtin.grain.fine.01');\n    expect(target).toBeDefined();\n    if (target === undefined) return;\n    target.alias = 'builtin.grain.unapproved.01';",
    "    const targetIndex = resources.findIndex((resource) => resource.alias === 'builtin.grain.fine.01');\n    expect(targetIndex).toBeGreaterThanOrEqual(0);\n    const target = resources[targetIndex];\n    if (target === undefined) return;\n    resources[targetIndex] = { ...target, alias: 'builtin.grain.unapproved.01' };",
    1,
)
test = test.replace(
    "    second.contentHash = first.contentHash;",
    "    resources[1] = { ...second, contentHash: first.contentHash };",
    1,
)
test = test.replace(
    "    target.byteLength = 3;\n    target.contentHash = hash(999);",
    "    resources[0] = { ...target, byteLength: 3, contentHash: hash(999) };\n    const configuredTarget = resources[0];\n    if (configuredTarget === undefined) return;",
    1,
)
test = test.replace("loader.load(target.alias);", "loader.load(configuredTarget.alias);", 2)
test = test.replace(
    "    target.byteLength = 1;\n    const loader = createFinalBuiltinSampledResourceLoaderV1(",
    "    resources[0] = { ...target, byteLength: 1 };\n    const configuredTarget = resources[0];\n    if (configuredTarget === undefined) return;\n    const loader = createFinalBuiltinSampledResourceLoaderV1(",
    1,
)
test = test.replace("loader.load(target.alias)).rejects", "loader.load(configuredTarget.alias)).rejects", 1)
test_path.write_text(test, encoding='utf-8')
