# Sideloading onto an iPhone

The iOS app is a thin native wrapper (Capacitor) that opens `https://health.villa-dev.com`
full screen. Think of it as a dedicated browser that only knows one site.

- **Web changes need no new install.** A deploy to `main` shows up the next time the app opens.
- **The app needs a connection.** Offline it shows a "Try again" screen.
- **Sign-in is separate from Safari.** Sign in once inside the app.

## What you need

- A Windows PC with the latest [Sideloadly](https://sideloadly.io/). Older versions have Apple ID
  login problems.
- iTunes and iCloud from Apple's website. The Microsoft Store versions don't work with Sideloadly.
- An Apple ID. Consider a spare one, because you type its password into a third-party tool.
- A USB cable for the iPhone

## 1. Get the IPA

An `.ipa` is the iPhone's install file. Building one requires a Mac, so GitHub builds it.

1. Open the [Build iOS IPA runs](https://github.com/jvilla1991/calorie-tracker-app/actions/workflows/ios-build.yml)
   (sign in to GitHub to download).
2. Open the latest green run and download `CalorieTracker-ipa` under **Artifacts**.
3. Unzip it to get `CalorieTracker.ipa`.
4. Save that file somewhere permanent. You reinstall from it to renew the app, and GitHub deletes
   build files after about 90 days.

## 2. Install it

1. Plug in the iPhone, unlock it, and tap **Trust** if asked.
2. Open Sideloadly, then choose your iPhone, your Apple ID, and `CalorieTracker.ipa`.
3. Click **Start** and enter your Apple ID password when asked.

## 3. Allow it on the iPhone

Do these once, after the first install:

1. **Settings > Privacy & Security > Developer Mode**: turn it on and let the phone restart. This
   option only appears after the first install.
2. **Settings > General > VPN & Device Management**: tap your Apple ID, then **Trust**.
3. Open the app, sign in, and allow camera access when you first scan a barcode.

## Keeping it working

| Apple account | App stops opening after | To renew |
|---|---|---|
| Free Apple ID | 7 days | Run step 2 again with the same IPA, or set up Sideloadly's auto-refresh |
| Paid Apple Developer ($99/year) | 1 year | Run step 2 again |

Install over the existing app, even after it has expired. Deleting it first signs you out, though
your diary is safe because it lives on the server. A free Apple ID is commonly limited to 3
sideloaded apps on a device at once.

## When a new IPA is needed

Only when the wrapper changes: `ios/`, `ios-shell/`, `capacitor.config.json`, or the Capacitor
packages. Pushing those changes builds a new IPA automatically. Once the workflow is on `main`, you can also
start a build from the Actions page with **Run workflow**. Use that if you lose your saved IPA and
GitHub has already deleted its copy.

After changing `capacitor.config.json` or adding a Capacitor plugin, run this and commit the result:

```powershell
npx cap sync ios
```

## Changing the icon

The icon is the same plain green square as the web app. To replace it, overwrite
`ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` with a 1024x1024 PNG that has
no transparency.

## Troubleshooting

- **Sideloadly doesn't see the iPhone:** check that iTunes is Apple's website version and that
  iTunes itself can see the phone.
- **Sideloadly can't sign in to your Apple ID:** update Sideloadly first. If it still fails, try
  its Remote Anisette option in settings.
- **White screen right after a web deploy:** close and reopen the app. If it stays white, check
  that `index.html` is served with `Cache-Control: no-cache`.
- **"Could not verify" or "Untrusted Developer" when opening the app:** repeat step 3.
- **The app won't open after a week:** the free signature expired. Run step 2 again.
- **The barcode scanner shows a camera error:** check
  **Settings > Calorie Tracker > Camera**.
