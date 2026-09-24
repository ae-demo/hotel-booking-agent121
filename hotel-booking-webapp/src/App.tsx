// Adapted from thunder-authentication's App.example.tsx pattern. The routing
// STRUCTURE below is prescribed (see that file's header comment for why):
// NoAccess sits ABOVE the shell route and replaces it; Forbidden sits INSIDE
// the shell; /forbidden is wired into authz/client once, from the router;
// every gated route is wrapped in RequireOperation, taken from SCREEN_ROUTES;
// /callback is routed outside the provider.
//
// This app has one screen (Chat), reachable by any signed-in traveler and by
// nobody signed out — see src/authz/screens.ts for why its `loads` is null.
// reachableScreens is therefore either [Chat] (signed in) or [] (nothing
// reachable yet, before the session resolves) — there is no second role or
// permission tier for the NoAccess question to distinguish here.

import { useEffect, type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@wso2/oxygen-ui";
import { AuthzProvider, Forbidden, NoAccess, useAuthz, useScopes } from "./authz/gates";
import { SCREEN_ROUTES, reachableScreens } from "./authz/screens";
import { setForbiddenNavigator } from "./authz/client";
import { signIn } from "./authz/session";
import { AppShell } from "./shell/AppShell";
import { CallbackPage } from "./pages/Callback";
import { ChatPage } from "./pages/Chat";
import { APP_NAME } from "./appName";

const PAGE_BY_KEY: Record<string, ReactElement> = {
  chat: <ChatPage />,
};

export function App(): ReactElement {
  return (
    <BrowserRouter>
      <ForbiddenWiring />
      <Routes>
        <Route path="/callback" element={<CallbackPage />} />
        <Route
          path="*"
          element={
            <AuthzProvider fallback={<Splash />}>
              <SignedIn />
            </AuthzProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * Hands src/authz/client.ts the route a refusal goes to. ONCE, from inside the
 * router and above every route, so it is wired before the first request can be
 * answered.
 */
function ForbiddenWiring(): null {
  const navigate = useNavigate();
  useEffect(() => {
    setForbiddenNavigator(() => navigate("/forbidden", { replace: true }));
  }, [navigate]);
  return null;
}

function Splash(): ReactElement {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        height: "100vh",
      }}
    >
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        Checking your session…
      </Typography>
    </Box>
  );
}

function SignedIn(): ReactElement {
  const { signedIn } = useAuthz();
  const scopes = useScopes();

  // The load-time guard. Only a MISSING session starts a sign-in: currentUser()
  // has already tried a silent renew, and signing in on a merely expired token
  // re-logs the user in on every visit.
  useEffect(() => {
    if (!signedIn) void signIn();
  }, [signedIn]);

  if (!signedIn) return <Splash />;

  const reachable = reachableScreens(scopes, signedIn);

  // NoAccess REPLACES the shell. It is returned here, above the <Routes> that
  // carry AppShell, so there is no rail to wrap it. It can only trigger for a
  // caller with no session, which the guard above already redirects — kept
  // anyway as the platform-prescribed carve-out for "nothing at all reaches".
  if (reachable.length === 0) return <NoAccess appName={APP_NAME} />;

  const landing = reachable[0].path;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={landing} replace />} />
        {SCREEN_ROUTES.map((screen) => (
          <Route key={screen.key} path={screen.path} element={PAGE_BY_KEY[screen.key]} />
        ))}
        {/* Forbidden is INSIDE the shell: the rail the caller can use stays. */}
        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="*" element={<Navigate to={landing} replace />} />
      </Route>
    </Routes>
  );
}
