# Coordination-Center UI — deploy

1. Build the API + infra: `cd central && sam build && sam deploy --guided`
2. Note the stack outputs: `ApiUrl`, `CognitoDomain`, `CoordinationCenterClientId`, `WebUrl`,
   `WebBucketName`.
3. Add `${WebUrl}/callback` to the `CoordinationCenterClient` `CallbackURLs` (edit
   `template.yaml` and redeploy, or set via the Cognito console).
4. Build the UI with runtime config:
   ```
   cd central/web
   VITE_API_URL=<ApiUrl> \
   VITE_COGNITO_DOMAIN=<CognitoDomain> \
   VITE_COGNITO_CLIENT_ID=<CoordinationCenterClientId> \
   VITE_REDIRECT_URI=<WebUrl>/callback \
   npm run build
   ```
5. Upload: `aws s3 sync dist/ s3://<WebBucketName>/ --delete`
6. Invalidate CloudFront if needed: `aws cloudfront create-invalidation --distribution-id <id> --paths '/*'`

> **Note:** the SAM template does not auto-upload `central/web/dist` (SAM doesn't bundle static
> sites). The `aws s3 sync` step (or a CI job) publishes the build. The `CognitoDomain` output and
> `AWS::Cognito::UserPoolDomain` resource already exist in `central/template.yaml` (added by the
> Central Serverless API plan).

## e2e tests (Playwright)

`npm run test:e2e` runs the smoke test against the production build via `npm run preview`.
If your OS can't download Playwright's managed browser, point Playwright at a system/cached
Chromium as documented in `plugins/sibyl/README.md`:

    PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm run test:e2e
