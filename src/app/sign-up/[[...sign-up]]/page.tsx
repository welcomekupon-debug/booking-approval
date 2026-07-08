import { SignUp } from "@clerk/nextjs";
import { AuthPanel } from "@/components/AuthPanel";

export default function SignUpPage() {
  return (
    <AuthPanel>
      <SignUp />
    </AuthPanel>
  );
}
