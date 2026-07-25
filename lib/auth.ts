import { betterAuth } from "better-auth";
import { sendEmail } from "@/lib/email";
import { LibsqlDialect } from "@libsql/kysely-libsql";

export const auth = betterAuth({
  database: {
    dialect: new LibsqlDialect({
      url: "libsql://yzta-bootcamp-emreekaratas.aws-eu-west-1.turso.io",
      authToken: process.env.TURSO_AUTH_TOKEN || "",
    }),
    type: "sqlite",
  },
  emailVerification: {
    sendOnSignUp: false,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Lokál — şifre sıfırlama",
        html: `<p>Merhaba ${user.name || ""},</p><p>Şifreni sıfırlamak için <a href="${url}">buraya tıkla</a>. Bağlantı 1 saat geçerlidir.</p><p>Bu isteği sen yapmadıysan bu maili yok sayabilirsin.</p>`,
      });
    },
  },
});