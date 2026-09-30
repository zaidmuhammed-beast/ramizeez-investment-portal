import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { getDict } from "@/i18n/server";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const user = await requireUser("password");
  const d = await getDict();
  const t = d.auth.password;
  return (
    <Card
      strong
      title={t.title}
      description={user.mustChangePassword ? t.temporary : undefined}
    >
      <ChangePasswordForm t={t} rules={d.passwordRules} />
    </Card>
  );
}
