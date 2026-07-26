import { Router } from "express";
const router = Router();

router.get("/privacy-policy", (_req, res) => {
  res.type("html").send(`
    <html>
      <head><title>Privacy Policy</title></head>
      <body style="font-family: Arial, sans-serif; margin: 2rem; line-height: 1.5;">
        <h1>Privacy Policy</h1>
        <p>We collect and store message content and profile metadata to provide customer support and appointment handling.</p>
        <p>Data deletion requests can be submitted by contacting support.</p>
        <p>This is a starter privacy policy and should be expanded before production use and App Review.</p>
      </body>
    </html>
  `);
});

export default router;