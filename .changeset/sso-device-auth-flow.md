---
"@toolbox/aws-creds": minor
---

Add SSO device authorization flow with manual URL option

- Implement full SSO OIDC device authorization flow (RegisterClient, StartDeviceAuthorization, CreateToken)
- Show device auth URL and code, press Enter to open browser or 'c' to copy URL
- Poll for token automatically after showing URL
- Save SSO token to cache (AWS CLI compatible format with correct permissions)
- Get role credentials directly with access token
- Remove dependency on @aws-sdk/client-sts and @aws-sdk/credential-providers
- Simplify checkTokenStatus to just check cache expiry (faster, no STS calls)
- Add sortByFavorites helper for DRY code
- Fix clipboard copy adding "-n" prefix (use printf instead of echo)
- Fix same URL shown for multiple profiles
- Update menu wording for clarity (Refresh now, Auto-refresh)
- Code cleanup: remove unused functions, simplify imports, use template strings
