import { RouterProvider } from "react-router";
import { AuthProvider } from "@/app/context/AuthContext";
import { router } from "./routes.tsx";

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
