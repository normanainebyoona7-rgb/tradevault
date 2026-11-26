import { createRoot } from "react-dom/client";
import App from "./App";
import { installMobileFetch } from "./api";
import "./styles.css";

installMobileFetch();
createRoot(document.getElementById("root")!).render(<App />);
