import AuthForm from "@/components/AuthForm";
export const metadata = { title: "Create account" };
export default function Signup() {
  return <div className="px-4"><AuthForm mode="signup" /></div>;
}
