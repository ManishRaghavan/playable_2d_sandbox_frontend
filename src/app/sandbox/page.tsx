"use client";

import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { initialTemplate } from "./utils";
import FTUEPopup from "./components/FTUEPopup";

// WebSocket server URL - can be changed in one place
const WS_SERVER_URL =
  process.env.NODE_ENV === "development"
    ? process.env.NEXT_PUBLIC_WS_SERVER_URL_DEV || "ws://127.0.0.1:8000" // Development URL
    : process.env.NEXT_PUBLIC_WS_SERVER_URL_PROD; // Production URL

// Backend health check URL
const BACKEND_HEALTH_URL =
  process.env.NODE_ENV === "development"
    ? "http://127.0.0.1:8000/generate/chat/health"
    : "https://playabale-2d-game-sandbox-backend.onrender.com/";

// Generate a unique user ID
const generateUserId = () => {
  return "user_" + Math.random().toString(36).substr(2, 9);
};

// Get today's date as string
const getTodayDate = () => {
  return new Date().toISOString().split("T")[0];
};

// Session management interface
interface UserSession {
  userId: string;
  messageCount: number;
  lastAccessDate: string;
}

// Toast notification component
const Toast = ({
  message,
  isVisible,
  onClose,
}: {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}) => {
  if (!isVisible) return null;

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-4">
      <p>{message}</p>
      <div className="flex items-center space-x-2 ml-2">
        {message.includes("Servers are busy") && (
          <button
            onClick={handleReload}
            className="bg-white text-red-500 px-3 py-1 rounded hover:bg-red-50 text-sm font-medium"
          >
            Reload
          </button>
        )}
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 ml-2"
        >
          ×
        </button>
      </div>
    </div>
  );
};

type Message = {
  role: string;
  message: string;
  state?: string;
  files?: Record<string, string>;
  isStreaming?: boolean;
  streamedContent?: string;
  hideThinkingAnimation?: boolean;
  is_not_related_to_game?: boolean | string;
};

// Initial colorful template

export default function SandboxPage() {
  const [selectedFile, setSelectedFile] = useState("index.html");
  const [viewMode, setViewMode] = useState<"code" | "preview">("code");
  const [fileContents, setFileContents] =
    useState<Record<string, string>>(initialTemplate);
  const [previewKey, setPreviewKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [wsError, setWsError] = useState<string | null>(
    "Connecting to server..."
  );
  const [wsConnected, setWsConnected] = useState(false);
  const [showToast, setShowToast] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      message: "Hello! I can help you modify and test your game code.",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [chatWidth, setChatWidth] = useState(320); // Default width 320px
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isClientSide, setIsClientSide] = useState(false);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [consoleMessages, setConsoleMessages] = useState<
    { type: "log" | "error" | "warn"; message: string; timestamp: string }[]
  >([]);
  const [showConsole, setShowConsole] = useState(false);
  const [isFixingErrors, setIsFixingErrors] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const consoleContainerRef = useRef<HTMLDivElement>(null);
  const initialMousePosRef = useRef<number>(0);
  const initialWidthRef = useRef<number>(320);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [receivedNotRelatedFalse, setReceivedNotRelatedFalse] = useState(false);
  const [showFTUE, setShowFTUE] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const editWsRef = useRef<WebSocket | null>(null);

  // Initialize client-side operations
  useEffect(() => {
    setIsClientSide(true);

    // Check if user has seen the FTUE
    const hasSeenFTUE = localStorage.getItem("hasSeenFTUE");
    if (!hasSeenFTUE) {
      setShowFTUE(true);
    }

    // Initialize or get user session from local storage
    const initializeUserSession = () => {
      const storedSession = localStorage.getItem("userSession");
      if (storedSession) {
        const session: UserSession = JSON.parse(storedSession);
        const today = getTodayDate();

        if (session.lastAccessDate !== today) {
          // Reset for new day
          const newSession = {
            userId: session.userId,
            messageCount: 0,
            lastAccessDate: today,
          };
          localStorage.setItem("userSession", JSON.stringify(newSession));
          setUserSession(newSession);
        } else {
          setUserSession(session);
        }
      } else {
        // Create new session
        const newSession = {
          userId: generateUserId(),
          messageCount: 0,
          lastAccessDate: getTodayDate(),
        };
        localStorage.setItem("userSession", JSON.stringify(newSession));
        setUserSession(newSession);
      }
    };

    initializeUserSession();
  }, []);

  // Check backend health before connecting
  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const response = await fetch(BACKEND_HEALTH_URL);
        const data = await response.json();

        if (data.status === 200) {
          console.log("Backend is healthy:", data.message);
          // Initialize WebSocket after successful health check
          initializeWebSocket();
        } else {
          console.error("Backend health check failed:", data);
          setWsError(
            "Backend service is not available. Please try again later."
          );
          setWsConnected(false);
          setShowToast(true);
        }
      } catch (error) {
        console.error("Failed to check backend health:", error);
        setWsError("Backend service is not available. Please try again later.");
        setWsConnected(false);
        setShowToast(true);
      }
    };

    checkBackendHealth();
  }, []);

  // WebSocket initialization function
  const initializeWebSocket = () => {
    try {
      wsRef.current = new WebSocket(`${WS_SERVER_URL}/generate/ws/chat`);

      wsRef.current.onopen = () => {
        console.log(`✅ WebSocket connected to ${WS_SERVER_URL}`);
        setWsError(null);
        setWsConnected(true);
        setTimeout(() => setShowToast(false), 3000);
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(
          "Received from WS - Full message:",
          JSON.stringify(data, null, 2)
        );
        console.log("Message state:", data.state);
        console.log("Message payload:", data.payload);
        console.log(
          "Message ai_assistance_message:",
          data.ai_assistance_message
        );

        // Extract is_not_related_to_game from the correct location
        const isNotRelatedToGame =
          data.is_not_related_to_game ||
          (data.payload && data.payload.is_not_related_to_game) ||
          (data.ai_assistance_message &&
            typeof data.ai_assistance_message === "object" &&
            data.ai_assistance_message.is_not_related_to_game);

        console.log("is_not_related_to_game value:", isNotRelatedToGame);
        console.log("is_not_related_to_game type:", typeof isNotRelatedToGame);

        if (data.state === "files_shared" && data.payload) {
          // Update file contents when receiving files
          setFileContents(data.payload);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              message: "I've updated the game files with the implementation.",
              state: "files_shared",
              files: data.payload,
              is_not_related_to_game: isNotRelatedToGame,
            },
            {
              role: "assistant",
              message:
                "From now on, you can edit the existing game. You can reload the page to start fresh and create a new game.",
              state: "ai_assistance_message",
              isStreaming: false,
              streamedContent:
                "From now on, you can edit the existing game. You can reload the page to start fresh and create a new game.",
              is_not_related_to_game: isNotRelatedToGame,
            },
          ]);
          setIsGenerating(false);
        } else if (data.state === "thinking") {
          // For thinking state, either update existing streaming message or create new one
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.isStreaming && lastMessage.state === "thinking") {
              // Update the existing streaming message's content by appending new content
              const updatedMessages = [...prev];
              const currentContent = lastMessage.streamedContent || "";
              updatedMessages[prev.length - 1] = {
                ...lastMessage,
                streamedContent: currentContent + data.payload.message + "\n",
              };
              return updatedMessages;
            } else {
              // Create new streaming message
              const newMessage = {
                role: "assistant",
                message: "",
                state: "thinking",
                isStreaming: true,
                streamedContent: data.payload.message,
                hideThinkingAnimation: false,
                is_not_related_to_game: isNotRelatedToGame,
              };

              // Check if this is the first thinking message with is_not_related_to_game: false
              if (
                isNotRelatedToGame === false ||
                isNotRelatedToGame === "false" ||
                isNotRelatedToGame === "False"
              ) {
                console.log("Setting receivedNotRelatedFalse to true");
                console.log(
                  "Current receivedNotRelatedFalse state:",
                  receivedNotRelatedFalse
                );
                setReceivedNotRelatedFalse(true);
                console.log("After setting receivedNotRelatedFalse to true");
              }

              return [...prev, newMessage];
            }
          });
        } else if (data.state === "ai_assistance_message") {
          // Update any thinking messages to hide their animations
          setMessages((prev) => {
            const updatedMessages = prev.map((msg) =>
              msg.state === "thinking"
                ? { ...msg, hideThinkingAnimation: true }
                : msg
            );
            // Add the new assistance message
            return [
              ...updatedMessages,
              {
                role: "assistant",
                message: data.payload.message,
                state: "ai_assistance_message",
                isStreaming: false,
                streamedContent: data.payload.message,
                is_not_related_to_game: isNotRelatedToGame,
              },
            ];
          });
          setIsGenerating(false);
        }
      };

      wsRef.current.onclose = () => {
        console.log("WebSocket disconnected");
        setWsError("Servers are busy. Please reload or try again later.");
        setWsConnected(false);
        setShowToast(true);
      };

      wsRef.current.onerror = (err) => {
        console.error("WebSocket error:", err);
        setWsError("Servers are busy. Please reload or try again later.");
        setWsConnected(false);
        setShowToast(true);
      };
    } catch (error) {
      console.error("Failed to initialize WebSocket:", error);
      setWsError("Servers are busy. Please reload or try again later.");
      setWsConnected(false);
      setShowToast(true);
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages, receivedNotRelatedFalse]);

  // Function to initialize edit WebSocket
  const initializeEditWebSocket = () => {
    if (editWsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      editWsRef.current = new WebSocket(
        `${WS_SERVER_URL}/generate/ws/chat/edit`
      );

      editWsRef.current.onopen = () => {
        console.log(`✅ Edit WebSocket connected to ${WS_SERVER_URL}`);
        setWsError(null);
      };

      editWsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received from Edit WS:", data);

        if (data.state === "files_shared" && data.payload) {
          setFileContents(data.payload);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              message: "I've updated the game files with the implementation.",
              state: "files_shared",
              files: data.payload,
            },
          ]);
          setIsEditing(false);
          setIsGenerating(false);
        } else if (data.state === "thinking") {
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.isStreaming && lastMessage.state === "thinking") {
              // Update the existing streaming message's content by appending new content
              const updatedMessages = [...prev];
              const currentContent = lastMessage.streamedContent || "";
              updatedMessages[prev.length - 1] = {
                ...lastMessage,
                streamedContent: currentContent + data.payload.message + "\n",
              };
              return updatedMessages;
            } else {
              // Create new streaming message
              return [
                ...prev,
                {
                  role: "assistant",
                  message: "",
                  state: "thinking",
                  isStreaming: true,
                  streamedContent: data.payload.message,
                  hideThinkingAnimation: false,
                },
              ];
            }
          });
        }
      };

      editWsRef.current.onclose = () => {
        console.log("Edit WebSocket disconnected");
        setWsError("Edit connection lost. Please reload or try again later.");
      };

      editWsRef.current.onerror = (err) => {
        console.error("Edit WebSocket error:", err);
        setWsError("Edit connection error. Please reload or try again later.");
      };
    } catch (error) {
      console.error("Failed to initialize Edit WebSocket:", error);
      setWsError(
        "Failed to connect to edit service. Please reload or try again later."
      );
    }
  };

  // Modified sendMessage function with message limit
  const sendMessage = () => {
    if (!inputMessage.trim() || !isClientSide) return;

    // Check message limit
    if (userSession && userSession.messageCount >= 3) {
      setWsError(
        "You've reached your daily message limit. Please try again tomorrow."
      );
      return;
    }

    // Add user message to chat immediately for both first and subsequent messages
    setMessages((prev) => [...prev, { role: "user", message: inputMessage }]);

    // Set generating state to true
    setIsGenerating(true);

    // Check if this is the first message
    const isFirstMessage = messages.length === 1;

    console.log(
      "Current receivedNotRelatedFalse state in sendMessage:",
      receivedNotRelatedFalse
    );
    console.log("Is first message:", isFirstMessage);

    if (isFirstMessage) {
      // First message goes to chat WebSocket
      if (!wsRef.current) return;
      const message = {
        user_id: userSession?.userId || "anonymous",
        role: "user",
        message: inputMessage,
        is_not_related_to_game: false,
        payload: {
          is_not_related_to_game: false,
        },
      };
      console.log("Sending first message:", message);
      wsRef.current.send(JSON.stringify(message));

      // Set receivedNotRelatedFalse to true after first message since we know it's a game request
      setReceivedNotRelatedFalse(true);
    } else if (receivedNotRelatedFalse) {
      // If we've received a thinking message with is_not_related_to_game: false, send to edit WebSocket
      console.log(
        "Sending to edit WebSocket because receivedNotRelatedFalse is true"
      );
      sendEditRequest(inputMessage);
    } else {
      // Continue sending to chat WebSocket
      if (!wsRef.current) return;
      const message = {
        user_id: userSession?.userId || "anonymous",
        role: "user",
        message: inputMessage,
        is_not_related_to_game: false,
        payload: {
          is_not_related_to_game: false,
        },
      };
      console.log("Sending subsequent message:", message);
      wsRef.current.send(JSON.stringify(message));
    }

    // Update message count in session
    if (userSession) {
      const updatedSession = {
        ...userSession,
        messageCount: userSession.messageCount + 1,
      };
      localStorage.setItem("userSession", JSON.stringify(updatedSession));
      setUserSession(updatedSession);
    }

    setInputMessage("");
  };

  // Modified sendEditRequest function
  const sendEditRequest = (prompt: string) => {
    if (!editWsRef.current || editWsRef.current.readyState !== WebSocket.OPEN) {
      initializeEditWebSocket();
      setTimeout(() => sendEditRequest(prompt), 1000);
      return;
    }

    const message = {
      prompt: prompt,
      files: fileContents,
      user_id: userSession?.userId || "anonymous",
    };

    setIsEditing(true);
    editWsRef.current.send(JSON.stringify(message));
  };

  // Render message limit indicator
  const renderMessageLimit = () => {
    if (!userSession) return null;

    const remainingMessages = 3 - userSession.messageCount;
    return (
      <div className="text-sm text-gray-400 mt-2">
        {remainingMessages > 0
          ? `${remainingMessages} messages remaining today`
          : "Daily message limit reached"}
      </div>
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-adjust textarea height
  const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    setInputMessage(e.target.value);
  };

  // Function to fetch files from backend
  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      // Replace this with your actual API endpoint
      const response = await fetch("/api/files");
      const data = await response.json();
      if (data && Object.keys(data).length > 0) {
        setFileContents(data);
      }
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to get language based on file extension
  const getLanguage = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "html":
        return "html";
      case "js":
        return "javascript";
      case "css":
        return "css";
      default:
        return "javascript";
    }
  };

  // Handle code changes
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setFileContents((prev) => ({
        ...prev,
        [selectedFile]: value,
      }));
      setPreviewKey((prev) => prev + 1);
    }
  };

  // Create combined preview HTML with console capture
  const getCombinedPreviewHtml = () => {
    const doc = fileContents["index.html"];

    // Add console capture script
    const consoleCaptureScript = `
      <script>
        // Capture console logs
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;
        const originalConsoleWarn = console.warn;
        
        // Function to send messages to parent
        function sendToParent(type, message) {
          try {
            window.parent.postMessage({
              type: 'console',
              consoleType: type,
              message: message,
              timestamp: new Date().toISOString()
            }, '*');
          } catch (e) {
            // Ignore errors when not in iframe
          }
        }
        
        // Override console methods
        console.log = function() {
          originalConsoleLog.apply(console, arguments);
          sendToParent('log', Array.from(arguments).join(' '));
        };
        
        console.error = function() {
          originalConsoleError.apply(console, arguments);
          sendToParent('error', Array.from(arguments).join(' '));
        };
        
        console.warn = function() {
          originalConsoleWarn.apply(console, arguments);
          sendToParent('warn', Array.from(arguments).join(' '));
        };
        
        // Capture unhandled errors
        window.onerror = function(message, source, lineno, colno, error) {
          sendToParent('error', \`\${message} at \${source}:\${lineno}:\${colno}\`);
          return false;
        };
        
        // Capture unhandled promise rejections
        window.onunhandledrejection = function(event) {
          sendToParent('error', \`Unhandled Promise Rejection: \${event.reason}\`);
        };
      </script>
    `;

    // Replace closing body tag with scripts and close body
    return doc.replace(
      "</body>",
      consoleCaptureScript +
        Object.entries(fileContents)
          .filter(([name]) => name !== "index.html" && name.endsWith(".js"))
          .map(([_, content]) => `<script>${content}</script>`)
          .join("\n") +
        "</body>"
    );
  };

  // Listen for console messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "console") {
        setConsoleMessages((prev) => [
          ...prev,
          {
            type: event.data.consoleType,
            message: event.data.message,
            timestamp: event.data.timestamp,
          },
        ]);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Scroll console to bottom when new messages arrive
  useEffect(() => {
    if (consoleContainerRef.current) {
      consoleContainerRef.current.scrollTop =
        consoleContainerRef.current.scrollHeight;
    }
  }, [consoleMessages]);

  // Clear console
  const clearConsole = () => {
    setConsoleMessages([]);
  };

  // Handle mouse down on resize handle
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    initialMousePosRef.current = e.clientX;
    initialWidthRef.current = chatWidth;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none"; // Prevent text selection while dragging
  };

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const delta = initialMousePosRef.current - e.clientX;
      const newWidth = Math.min(
        Math.max(initialWidthRef.current + delta, 280),
        800
      ); // Min 280px, Max 800px
      setChatWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Function to clear WebSocket error
  const clearWsError = () => setWsError(null);

  // Function to fix console errors
  const fixConsoleErrors = () => {
    if (!isClientSide || isFixingErrors) return;

    // Filter only error messages
    const errorMessages = consoleMessages.filter((msg) => msg.type === "error");

    if (errorMessages.length === 0) {
      setWsError("No console errors to fix.");
      return;
    }

    // Format error messages for the prompt
    const formattedErrors = errorMessages
      .map(
        (msg) =>
          `[${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.message}`
      )
      .join("\n");

    // Create a prompt that includes all errors and request to fix them
    const prompt = `Please fix all these console errors in the game files. Here are the errors:\n\n${formattedErrors}\n\nPlease analyze the errors and provide the necessary fixes to the game files.`;

    // Set fixing state
    setIsFixingErrors(true);

    // Send to edit WebSocket
    if (!editWsRef.current || editWsRef.current.readyState !== WebSocket.OPEN) {
      initializeEditWebSocket();
      setTimeout(() => {
        const message = {
          prompt: prompt,
          files: fileContents,
          user_id: userSession?.userId || "anonymous",
          is_not_related_to_game: false,
        };
        console.log("Sending fix errors request:", message);
        editWsRef.current?.send(JSON.stringify(message));
        setIsFixingErrors(false);
      }, 1000);
      return;
    }

    const message = {
      prompt: prompt,
      files: fileContents,
      user_id: userSession?.userId || "anonymous",
      is_not_related_to_game: false,
    };

    console.log("Sending fix errors request:", message);
    editWsRef.current.send(JSON.stringify(message));

    // Add a message to the chat
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        message: "Fix all console errors in the game files.",
      },
    ]);

    // Update message count in session
    if (userSession) {
      const updatedSession = {
        ...userSession,
        messageCount: userSession.messageCount + 1,
      };
      localStorage.setItem("userSession", JSON.stringify(updatedSession));
      setUserSession(updatedSession);
    }

    // Reset fixing state after a delay
    setTimeout(() => {
      setIsFixingErrors(false);
    }, 1000);
  };

  // Function to copy message content
  const copyMessageContent = (index: number) => {
    const message = messages[index];
    const contentToCopy = message.isStreaming
      ? message.streamedContent || ""
      : message.message;

    navigator.clipboard
      .writeText(contentToCopy)
      .then(() => {
        setCopiedMessageIndex(index);
        setTimeout(() => setCopiedMessageIndex(null), 2000); // Reset after 2 seconds
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
      });
  };

  // Handle FTUE close
  const handleFTUEClose = () => {
    setShowFTUE(false);
    localStorage.setItem("hasSeenFTUE", "true");
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Reconnect WebSocket when tab becomes visible
        if (wsRef.current?.readyState === WebSocket.CLOSED) {
          initEditWebSocket();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const initEditWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    const newWs = new WebSocket(
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/edit"
    );
    wsRef.current = newWs;

    newWs.onopen = () => {
      console.log("WebSocket connected");
    };

    newWs.onclose = () => {
      console.log("WebSocket disconnected");
      // Attempt to reconnect after a delay
      setTimeout(initEditWebSocket, 3000);
    };

    newWs.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    newWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "edit") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", message: data.content },
          ]);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
  };

  return (
    <div className="flex h-screen w-full bg-[hsl(60deg_2.7%_14.51%)] text-white">
      {showFTUE && <FTUEPopup onClose={handleFTUEClose} />}
      <Toast
        message={
          wsConnected ? "Connected to server" : wsError || "Connecting..."
        }
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
      {/* File Tree Sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-gray-700 bg-[hsl(60deg_2.7%_12%)] p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Game Files</h2>
          <button
            onClick={fetchFiles}
            className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors"
            disabled={isLoading}
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
          </button>
        </div>
        <div className="space-y-2">
          {Object.keys(fileContents).map((filename) => (
            <div
              key={filename}
              className={`flex items-center space-x-2 cursor-pointer p-2 rounded ${
                selectedFile === filename ? "bg-blue-500" : "hover:bg-gray-800"
              }`}
              onClick={() => setSelectedFile(filename)}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={
                    filename.endsWith(".html")
                      ? "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      : "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  }
                />
              </svg>
              <span className="text-sm">{filename}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Center Panel with Editor/Preview Toggle */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
          <div className="text-sm font-medium">{selectedFile}</div>
          <div className="flex items-center space-x-2">
            {/* Fix Console Errors Button */}
            {viewMode === "preview" &&
              consoleMessages.some((msg) => msg.type === "error") && (
                <div className="relative group">
                  <button
                    onClick={fixConsoleErrors}
                    disabled={
                      isFixingErrors ||
                      !isClientSide ||
                      (userSession?.messageCount ?? 0) >= 3
                    }
                    className={`flex items-center space-x-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isFixingErrors ||
                      !isClientSide ||
                      (userSession?.messageCount ?? 0) >= 3
                        ? "bg-gray-600 cursor-not-allowed"
                        : "bg-red-500 hover:bg-red-600"
                    }`}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span>Fix Errors</span>
                    <span className="ml-1 text-xs bg-white text-red-500 px-1 rounded">
                      BETA
                    </span>
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-64 bg-gray-800 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                    This feature will attempt to fix all console errors in your
                    game files. It may not work properly in all cases.
                  </div>
                </div>
              )}

            <div className="flex space-x-1 rounded-lg bg-gray-800 p-1">
              <button
                onClick={() => setViewMode("code")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === "code"
                    ? "bg-blue-500 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <div className="flex items-center space-x-1">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                  <span>Code</span>
                </div>
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === "preview"
                    ? "bg-blue-500 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <div className="flex items-center space-x-1">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  <span>Preview</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {viewMode === "code" ? (
            <Editor
              height="100%"
              language={getLanguage(selectedFile)}
              value={fileContents[selectedFile]}
              theme="vs-dark"
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: false,
                automaticLayout: true,
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 bg-white">
                <iframe
                  key={previewKey}
                  className="w-full h-full border-0"
                  srcDoc={getCombinedPreviewHtml()}
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
              <div className="border-t border-gray-700 bg-gray-900">
                <div className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowConsole(!showConsole)}
                      className="text-sm font-medium text-gray-300 hover:text-white"
                    >
                      {showConsole ? "Hide Console" : "Show Console"}
                    </button>
                    {showConsole && (
                      <button
                        onClick={clearConsole}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {consoleMessages.length} messages
                  </div>
                </div>
                {showConsole && (
                  <div
                    ref={consoleContainerRef}
                    className="h-48 overflow-y-auto bg-black text-gray-300 font-mono text-xs p-2"
                  >
                    {consoleMessages.length === 0 ? (
                      <div className="text-gray-500 italic">
                        No console messages yet
                      </div>
                    ) : (
                      consoleMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={`py-1 ${
                            msg.type === "error"
                              ? "text-red-400"
                              : msg.type === "warn"
                              ? "text-yellow-400"
                              : "text-gray-300"
                          }`}
                        >
                          <span className="text-gray-500 mr-2">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                          {msg.message}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resize Handle */}
      <div
        className="w-1 hover:w-2 bg-gray-700 hover:bg-blue-500 cursor-ew-resize transition-all"
        onMouseDown={handleMouseDown}
      />

      {/* Chat Panel */}
      <div
        className="flex-shrink-0 border-l border-gray-700 bg-[hsl(60deg_2.7%_12%)]"
        style={{ width: `${chatWidth}px` }}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-700 p-4">
            <h2 className="text-lg font-semibold">AI Assistant</h2>
            {isClientSide && renderMessageLimit()}
          </div>
          <div className="flex-1 overflow-y-auto p-4" ref={chatContainerRef}>
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`rounded-lg p-3 ${
                    msg.role === "user"
                      ? "bg-blue-500 ml-8"
                      : msg.state === "thinking"
                      ? "bg-gray-800/30 mr-8 text-[14px]"
                      : "bg-gray-800 mr-8"
                  }`}
                >
                  <div className="space-y-2">
                    {msg.state === "thinking" && (
                      <div className="flex items-center space-x-2 text-gray-400">
                        <div
                          className={
                            msg.hideThinkingAnimation
                              ? "text-gray-300"
                              : "animate-pulse"
                          }
                        >
                          {msg.hideThinkingAnimation ? "Thoughts" : "Thinking"}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-start">
                      <p
                        className={`text-sm whitespace-pre-wrap ${
                          msg.state === "thinking" ? "text-gray-400" : ""
                        }`}
                      >
                        {msg.isStreaming ? msg.streamedContent : msg.message}
                      </p>
                      <button
                        onClick={() => copyMessageContent(index)}
                        className="ml-2 p-1 rounded-full hover:bg-gray-700 transition-colors"
                        title="Copy message"
                      >
                        {copiedMessageIndex === index ? (
                          <svg
                            className="h-4 w-4 text-green-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-4 w-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  {msg.files && (
                    <div className="mt-2 text-xs text-gray-400">
                      Files updated: {Object.keys(msg.files).join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-700 p-4">
            <div className="flex space-x-2">
              <div className="flex-1 min-h-[40px] max-h-[200px] relative rounded-lg bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500">
                <textarea
                  value={inputMessage}
                  onChange={adjustTextareaHeight}
                  onKeyDown={handleKeyPress}
                  placeholder={
                    isGenerating
                      ? "Generating..."
                      : (userSession?.messageCount ?? 0) >= 3
                      ? "Daily message limit reached"
                      : "Type your message..."
                  }
                  rows={1}
                  disabled={
                    isGenerating || (userSession?.messageCount ?? 0) >= 3
                  }
                  className={`w-full h-full min-h-[40px] max-h-[200px] rounded-lg bg-transparent px-4 py-2 text-sm focus:outline-none resize-none overflow-y-auto ${
                    isGenerating || (userSession?.messageCount ?? 0) >= 3
                      ? "cursor-not-allowed opacity-50"
                      : ""
                  }`}
                  style={{
                    lineHeight: "1.5",
                  }}
                />
                {isGenerating && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg
                      className="animate-spin h-4 w-4 text-blue-400"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <button
                onClick={sendMessage}
                disabled={
                  isEditing ||
                  isGenerating ||
                  !isClientSide ||
                  (userSession?.messageCount ?? 0) >= 3
                }
                className={`rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 self-end ${
                  isEditing ||
                  isGenerating ||
                  !isClientSide ||
                  (userSession?.messageCount ?? 0) >= 3
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
                }`}
              >
                {isEditing ? (
                  <div className="flex items-center space-x-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Editing...</span>
                  </div>
                ) : isGenerating ? (
                  <div className="flex items-center space-x-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Generating...</span>
                  </div>
                ) : (userSession?.messageCount ?? 0) >= 3 ? (
                  "Limit Reached"
                ) : (
                  "Send"
                )}
              </button>
            </div>
            {isClientSide && renderMessageLimit()}
          </div>
        </div>
      </div>
    </div>
  );
}
