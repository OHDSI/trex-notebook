# SAM custom build for the ApiFunction. SAM runs `make build-ApiFunction` in this
# directory (CodeUri), where the @central/shared symlink resolves, so the api's
# own esbuild produces a self-contained dist/index.mjs that we copy to the
# SAM-provided $(ARTIFACTS_DIR). Handler is index.handler (ESM .mjs).
build-ApiFunction:
	npm run build
	cp dist/index.mjs "$(ARTIFACTS_DIR)/index.mjs"
