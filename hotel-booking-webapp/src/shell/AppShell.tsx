import type { JSX } from "react";
import { Outlet, Link as RouterLink } from "react-router-dom";
import {
  AppShell as OxygenAppShell,
  ColorSchemeToggle,
  Divider,
  Footer,
  Header,
  Sidebar,
  UserMenu,
} from "@wso2/oxygen-ui";
import { LogOut, MessageSquare } from "@wso2/oxygen-ui-icons-react";
import { APP_NAME } from "../appName";
import { signOut } from "../authz/session";
import { useAuthz } from "../authz/gates";

/** The signed-in app chrome — every gated screen renders inside it. Matches the
 * wireframes' `navbar "Hotel Booking"` + `sidebar "Chat -> Chat"` on every
 * screen this app draws (there is only the one, Chat). */
export function AppShell(): JSX.Element {
  const { username } = useAuthz();

  return (
    <OxygenAppShell>
      <OxygenAppShell.Navbar>
        <Header>
          <Header.Toggle />
          <Header.Brand>
            <Header.BrandTitle>{APP_NAME}</Header.BrandTitle>
          </Header.Brand>
          <Header.Spacer />
          <Header.Actions>
            <ColorSchemeToggle />
            <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
            <UserMenu>
              <UserMenu.Trigger name={username || "Traveler"} />
              <UserMenu.Header name={username || "Traveler"} email="" />
              <UserMenu.Logout icon={<LogOut />} onClick={() => void signOut()} />
            </UserMenu>
          </Header.Actions>
        </Header>
      </OxygenAppShell.Navbar>

      <OxygenAppShell.Sidebar>
        <Sidebar activeItem="chat">
          <Sidebar.Nav>
            <Sidebar.Category>
              <Sidebar.Item id="chat" link={<RouterLink to="/chat" />}>
                <Sidebar.ItemIcon>
                  <MessageSquare />
                </Sidebar.ItemIcon>
                <Sidebar.ItemLabel>Chat</Sidebar.ItemLabel>
              </Sidebar.Item>
            </Sidebar.Category>
          </Sidebar.Nav>
        </Sidebar>
      </OxygenAppShell.Sidebar>

      <OxygenAppShell.Main>
        <Outlet />
      </OxygenAppShell.Main>

      <OxygenAppShell.Footer>
        <Footer>
          <Footer.Copyright>© {new Date().getFullYear()} {APP_NAME}</Footer.Copyright>
        </Footer>
      </OxygenAppShell.Footer>
    </OxygenAppShell>
  );
}
