# Deploy the Streamlit demo (free, public link)

The Streamlit app (`streamlit_app.py`) reuses the same backend code as the
FastAPI version: demo mode, budget maths, AI prompts and PDF export.
No separate backend server is needed.

## Try it on your computer first (optional)

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

It opens at http://localhost:8501 and works immediately in demo mode.
For AI mode locally, copy `.streamlit/secrets.toml.example` to
`.streamlit/secrets.toml` and put your Groq key in it.

## Deploy so everyone can open it

1. Push this whole folder to your GitHub repository (branch `main`).
   Make sure `streamlit_app.py` and `requirements.txt` are in the ROOT of the repo.
2. Go to https://share.streamlit.io and sign in with GitHub.
3. Click **Create app** > **Deploy a public app from GitHub**.
4. Choose your repository and the `main` branch.
5. Set **Main file path** to `streamlit_app.py`.
6. Open **Advanced settings** and choose **Python 3.12** or **3.13**.
7. (Optional, for AI mode) paste this into **Secrets**:
   ```toml
   GROQ_API_KEY = "your-groq-key"
   ```
   Never commit the key to GitHub. Skip this step to run in demo mode only.
8. Click **Deploy** and wait a few minutes for the build.
9. Copy your address, which looks like `https://<name>.streamlit.app`.
   Anyone can open it, no login needed. Put it in your submission as the extra demo link.

## Planning ANY destination (e.g. Udaipur)

Demo mode only knows a few sample destinations; anything else is replaced by the
closest sample. AI mode plans any destination. Two ways to turn it on:

1. **You, the owner (recommended before sharing the link):** get a free key at
   https://console.groq.com/keys and paste `GROQ_API_KEY = "gsk_..."` into the
   app's **Settings > Secrets** on Streamlit Cloud, then reboot the app.
2. **Any visitor:** the sidebar has a "Your Groq API key" box. A pasted key is
   used only for that visitor's session (never saved, never shared, no limit).

## Good to know

- **Public link and your AI key:** each visitor is limited to 10 AI requests per
  session (change with `AI_CALLS_PER_SESSION` in Secrets). After that, the app
  switches to demo mode so your free Groq quota is protected.
- **Sleeping app:** free apps sleep after a period of no visits. Opening the
  link and clicking "Yes, get this app back up!" wakes it in about 30 seconds.
  Open it once before you share it or submit it.
- **Updating:** every `git push` to `main` redeploys automatically.
- **Build error "ModuleNotFoundError"?** Check that `requirements.txt` is in
  the repo root and that you pushed it.
