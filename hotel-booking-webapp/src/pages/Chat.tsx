import { useEffect, useRef, useState, type FormEvent, type JSX } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  PageContent,
  PageTitle,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { sendMessage, type ChatResponse } from "../api";
import { ApiError, ForbiddenError } from "../authz/client";

interface Message {
  readonly role: "user" | "assistant";
  readonly text: string;
}

// Persisted so a refresh continues the same conversation with the agent,
// which keeps the actual transcript server-side (react-webapp's "An ai-agent
// dependency has one fixed chat contract" — the agent keeps the conversation,
// the SPA keeps only the id and its own rendering transcript).
const CONVERSATION_ID_KEY = "hotel-booking-webapp.conversationId";

const GREETING: Message = { role: "assistant", text: "Hi! Where would you like to stay?" };

export function ChatPage(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useRef<string | undefined>(
    sessionStorage.getItem(CONVERSATION_ID_KEY) ?? undefined,
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(event: FormEvent): Promise<void> {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const response: ChatResponse = await sendMessage(text, conversationId.current);
      conversationId.current = response.conversationId;
      sessionStorage.setItem(CONVERSATION_ID_KEY, response.conversationId);
      setMessages((prev) => [...prev, { role: "assistant", text: response.text }]);
    } catch (err) {
      if (err instanceof ForbiddenError) {
        setError(err.message);
      } else if (err instanceof ApiError) {
        setError("The booking agent could not be reached. Please try again.");
      } else {
        setError("Something went wrong sending your message. Please try again.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Chat</PageTitle.Header>
        <PageTitle.SubHeader>
          Talk to the booking agent to search, book and manage your stays
        </PageTitle.SubHeader>
      </PageTitle>

      <Card>
        <CardHeader title="Conversation" />
        <Divider />
        <CardContent>
          <Box sx={{ maxHeight: 480, overflowY: "auto" }}>
            <List>
              {messages.map((message, index) => (
                <ListItem key={index} alignItems="flex-start">
                  <ListItemText
                    primary={message.role === "user" ? "You" : "Agent"}
                    secondary={message.text}
                    slotProps={{
                      primary: { variant: "overline", color: "text.secondary" },
                      secondary: { variant: "body1", color: "text.primary" },
                    }}
                  />
                </ListItem>
              ))}
            </List>
            <div ref={bottomRef} />
          </Box>

          {error ? (
            <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
              {error}
            </Typography>
          ) : null}
        </CardContent>
      </Card>

      <Box component="form" onSubmit={handleSend} sx={{ mt: 3 }}>
        <Stack direction="row" spacing={2} alignItems="flex-end">
          <TextField
            fullWidth
            label="Type a message..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={sending}
          />
          <Button type="submit" variant="contained" disabled={sending || !input.trim()}>
            {sending ? <CircularProgress size={20} /> : "Send"}
          </Button>
        </Stack>
      </Box>
    </PageContent>
  );
}
