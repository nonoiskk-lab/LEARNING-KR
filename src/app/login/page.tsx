import AuthForm from "@/components/AuthForm";
export const metadata = { title: "Log in" };
export default function Login() {
  return <div className="px-4"><AuthForm mode="login" /></div>;
}
