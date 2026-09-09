import ReactDOM from "react-dom/client";
import App from "./App";
import { worker } from "./mocks/browser";

worker.start().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
});
