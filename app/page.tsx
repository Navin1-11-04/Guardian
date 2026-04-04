import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import ChatUI from "./components/ChatUI";

export default async function Home() {
  const session = await auth0.getSession();
  
  if (!session) {
    redirect("/auth/login");
  }

  return <ChatUI user={session.user} />;
}