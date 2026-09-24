import { useEffect, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography } from "@wso2/oxygen-ui";
import { handleCallback } from "../authz/session";

/**
 * The one registered redirect URI, serving both the sign-in redirect and the
 * silent-renew iframe (thunder-authentication). `handleCallback()` dispatches
 * whichever leg landed here and resolves to nothing; only the redirect leg
 * needs to leave this page, and it always lands the caller back at "/".
 */
export function CallbackPage(): JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    let live = true;
    void handleCallback().finally(() => {
      if (live) navigate("/", { replace: true });
    });
    return () => {
      live = false;
    };
  }, [navigate]);

  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <Typography variant="body1">Signing you in…</Typography>
    </Box>
  );
}
