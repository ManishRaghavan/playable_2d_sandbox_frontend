export const initialTemplate = {
  "index.html": `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Game Sandbox</title>
    <style>
      body {
        margin: 0;
        padding: 20px;
        min-height: 100vh;
        background: linear-gradient(135deg, #1e1e2e 0%, #2d2b55 100%);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .container {
        text-align: center;
        color: #fff;
        padding: 2rem;
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
      }
      h1 {
        font-size: 2.5rem;
        margin-bottom: 1rem;
        background: linear-gradient(to right, #ff0080, #7928ca);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      p {
        font-size: 1.2rem;
        color: #a0aec0;
        margin-bottom: 2rem;
      }
      .start-button {
        padding: 1rem 2rem;
        font-size: 1.1rem;
        color: white;
        background: linear-gradient(to right, #ff0080, #7928ca);
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
        transition: transform 0.2s;
      }
      .start-button:hover {
        transform: translateY(-2px);
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Welcome to Game Sandbox</h1>
      <p>Start building your game by editing the files in the editor.</p>
      <button class="start-button" onclick="alert('Ready to start coding!')">Get Started</button>
    </div>
  </body>
  </html>`,
  "script.js": `// Your game code will appear here
  console.log("Game sandbox initialized!");`,
};
