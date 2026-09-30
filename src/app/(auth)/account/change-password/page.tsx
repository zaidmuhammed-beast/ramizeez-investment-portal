import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const user = await requireUser("password");
  return (
    <Card
      strong
      title="Set a new password"
      description={user.mustChangePassword ? "Your account was created with a temporary password. Choose your own to continue." : undefined}
    >
      <ChangePasswordForm />
    </Card>
  );
}
