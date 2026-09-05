from pathlib import Path

# Reuse the currently published preview resource so opening Library repeatedly does not leak files.
p = Path('src/app/project-preview-store.ts')
s = p.read_text()
s = s.replace(
    "  async write(projectIdValue: ProjectId | string, blob: Blob): Promise<ResourceId> {",
    "  async write(\n    projectIdValue: ProjectId | string,\n    blob: Blob,\n    resourceIdValue?: ResourceId | string,\n  ): Promise<ResourceId> {",
    1,
)
s = s.replace(
    "    const resourceId = createResourceId();",
    "    const resourceId =\n      resourceIdValue === undefined ? createResourceId() : parseResourceId(resourceIdValue);",
    1,
)
p.write_text(s)

# Protect the actively edited project from being moved to Recently Deleted while the editor owns it.
p = Path('src/app/m9a-library-surface.ts')
s = p.read_text()
s = s.replace(
    "  readonly canReturnToEditor: () => boolean;",
    "  readonly canReturnToEditor: () => boolean;\n  readonly activeProjectId: () => ProjectId | null;",
    1,
)
s = s.replace(
    "        article.tabIndex = 0;\n        const preview",
    "        article.tabIndex = 0;\n        const isActiveProject = options.activeProjectId() === card.projectId;\n        const preview",
    1,
)
s = s.replace(
    "        heading.append(name);\n        if (card.recovery.coherent) {",
    "        heading.append(name);\n        if (isActiveProject) {\n          const editing = document.createElement('span');\n          editing.className = 'm9a-recovery-badge';\n          editing.textContent = 'Editing';\n          editing.title = '現在エディターで開いているため削除できません';\n          heading.append(editing);\n        }\n        if (card.recovery.coherent) {",
    1,
)
old = """          const remove = createButton('削除', 'm9a-card-action is-danger');
          remove.addEventListener('click', async () => {
            setBusy(true);
            try {
              await options.controller.trash(card.projectId);
              options.productShell.showToast('Recently Deletedへ移動しました');
              await refresh();
            } catch (error) {
              setError(error);
            } finally {
              setBusy(false);
            }
          });
          actions.append(open, rename, duplicate, remove);"""
new = """          actions.append(open, rename, duplicate);
          if (!isActiveProject) {
            const remove = createButton('削除', 'm9a-card-action is-danger');
            remove.addEventListener('click', async () => {
              setBusy(true);
              try {
                await options.controller.trash(card.projectId);
                options.productShell.showToast('Recently Deletedへ移動しました');
                await refresh();
              } catch (error) {
                setError(error);
              } finally {
                setBusy(false);
              }
            });
            actions.append(remove);
          }"""
assert old in s
s = s.replace(old, new, 1)
p.write_text(s)

# Production startup supplies the active project identity and overwrites the previous thumbnail in place.
p = Path('src/app/main.ts')
s = p.read_text()
s = s.replace(
    "    const resourceId = await previews.write(current.projectId, thumbnail);",
    "    const projects = await controller.query({ section: 'projects' });\n    const previousPreview = projects.cards.find(\n      (card) => card.projectId === current.projectId,\n    )?.previewResourceId;\n    const resourceId = await previews.write(current.projectId, thumbnail, previousPreview ?? undefined);",
    1,
)
s = s.replace(
    "      canReturnToEditor: () => paintSession.currentDocument() !== null,",
    "      canReturnToEditor: () => paintSession.currentDocument() !== null,\n      activeProjectId: () => paintSession.currentDocument()?.projectId ?? null,",
    1,
)
p.write_text(s)

# Preview unit test: avoid optional ArrayBuffer and prove stable resource overwrite.
p = Path('tests/unit/project-preview-store.test.ts')
s = p.read_text()
s = s.replace(
    "    expect(restored?.type).toBe(PNG_MIME_TYPE);\n    expect(new Uint8Array(await restored?.arrayBuffer())).toEqual(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    );",
    "    expect(restored).not.toBeNull();\n    expect(restored?.type).toBe(PNG_MIME_TYPE);\n    const restoredBytes = new Uint8Array(await restored!.arrayBuffer());\n    expect(restoredBytes).toEqual(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));\n\n    const replacement = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1])], {\n      type: PNG_MIME_TYPE,\n    });\n    const reusedResourceId = await store.write(projectId, replacement, resourceId);\n    expect(reusedResourceId).toBe(resourceId);\n    expect((await store.read(projectId, resourceId))?.size).toBe(9);",
    1,
)
p.write_text(s)

# Permanent contract tests/verifier must keep the active-project deletion protection and stable preview overwrite.
p = Path('tests/unit/m9a-library-production.test.ts')
s = p.read_text()
s = s.replace(
    "    expect(mainSource).toContain('await controller.updatePreview(current.projectId, resourceId)');",
    "    expect(mainSource).toContain('await controller.updatePreview(current.projectId, resourceId)');\n    expect(mainSource).toContain('previousPreview ?? undefined');",
    1,
)
s = s.replace(
    "    expect(librarySource).toContain(\"recovery.title = '復元可能なcheckpointがあります'\");",
    "    expect(librarySource).toContain(\"recovery.title = '復元可能なcheckpointがあります'\");\n    expect(librarySource).toContain('if (!isActiveProject)');",
    1,
)
p.write_text(s)

p = Path('scripts/verify-m9a-local-project-library.mjs')
s = p.read_text()
s = s.replace(
    "requireText(main, 'controller.updatePreview(current.projectId, resourceId)', 'thumbnail metadata publication');",
    "requireText(main, 'controller.updatePreview(current.projectId, resourceId)', 'thumbnail metadata publication');\nrequireText(main, 'previousPreview ?? undefined', 'stable preview resource reuse');",
    1,
)
s = s.replace(
    "requireText(surface, \"recovery.textContent = 'Recovery'\", 'non-colour recovery label');",
    "requireText(surface, \"recovery.textContent = 'Recovery'\", 'non-colour recovery label');\nrequireText(surface, 'if (!isActiveProject)', 'active-project delete protection');",
    1,
)
p.write_text(s)
