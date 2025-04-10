import React from "react";

interface FTUEPopupProps {
  onClose: () => void;
}

const FTUEPopup: React.FC<FTUEPopupProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[hsl(60deg_2.7%_12%)] p-6 rounded-lg max-w-2xl w-full mx-4 border border-gray-700">
        <h2 className="text-xl font-semibold mb-4">
          Welcome to the 2D Game Sandbox! 🎮
        </h2>

        <div className="space-y-4 text-gray-300">
          <p>
            This is a powerful tool that helps you create and modify 2D games
            using AI assistance.
          </p>

          <div>
            <h3 className="font-medium text-white mb-2">Key Features:</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>AI-powered game development assistance</li>
              <li>Real-time code editing and preview</li>
              <li>Console error detection and fixing</li>
              <li>Live game preview with console output</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-white mb-2">How to Use:</h3>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Type your game requirements in the chat</li>
              <li>Use the code editor to make manual changes</li>
              <li>Preview your game in real-time</li>
              <li>Fix any console errors using the "Fix Errors" button</li>
            </ol>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 mt-4">
            <p className="text-yellow-400">
              ⚠️ This is a beta version and might have some issues. If you
              encounter any problems, please report them to:
            </p>
            <ul className="mt-2 space-y-1">
              <li>
                Email:{" "}
                <a
                  href="mailto:manishrr@mplgaming.com"
                  className="text-blue-400 hover:underline"
                >
                  manishrr@mplgaming.com
                </a>
              </li>
              <li>
                Slack: <span className="text-blue-400">@ManishRR</span>
              </li>
            </ul>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Got it! Let's start creating games
        </button>
      </div>
    </div>
  );
};

export default FTUEPopup;
