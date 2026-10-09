import { type Metadata } from "next";
import { LegalPage, SupportEmail } from "~/components/legal-page";
import { BRAND } from "~/config/brand";

export const metadata: Metadata = {
  title: `Privacy Policy · ${BRAND.productName}`,
};

const { productName, companyName } = BRAND;

// Each row is a service that actually receives data today; update this list when that changes.
const PROVIDERS = [
  ["Vercel", "hosts the website and runs its server code"],
  ["Supabase", "our database: your account, jobs, clips, and credit history"],
  [
    "Amazon Web Services (S3)",
    "stores your uploaded videos and finished clips, in the United States",
  ],
  ["Modal", "runs the video processing: transcription, reframing, captions"],
  [
    "Google (Gemini API)",
    "receives the transcript text to choose clip-worthy moments; we use Google’s paid API tier, under which Google doesn’t use it to train its models",
  ],
  ["Inngest", "queues processing jobs; it sees job and account IDs only"],
  [
    "Stripe",
    "processes payments; your card details go to Stripe and never reach us",
  ],
  ["Resend", "sends our emails, such as confirmation and password-reset links"],
] as const;

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what {companyName} collects when you use{" "}
        {productName}, why, and what you can ask us to do with it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your email address and a hashed (not
          readable) version of your password.
        </li>
        <li>
          <strong>Your content:</strong> the videos you upload, the clips we
          make from them, and their transcripts while they’re being processed.
        </li>
        <li>
          <strong>Payments:</strong> a Stripe customer ID and a record of the
          credits you’ve bought and used. We never see or store card numbers.
        </li>
        <li>
          <strong>Technical data:</strong> your IP address and request logs,
          used to keep accounts secure and to limit abuse (for example, too many
          sign-in attempts).
        </li>
        <li>
          <strong>Cookies:</strong> one sign-in cookie that keeps you logged in.
          We don’t use advertising or tracking cookies.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To make your clips and show them to you.</li>
        <li>To run your account, sell you credits, and keep their history.</li>
        <li>
          To send emails you need: confirming your address, resetting your
          password, and important notices about the service.
        </li>
        <li>To keep {productName} secure and prevent abuse.</li>
      </ul>
      <p>
        We don’t sell your personal information or share it for advertising, and
        we don’t use your videos to train AI models.
      </p>

      <h2>Who processes it for us</h2>
      <p>
        These companies run parts of {productName} on our behalf and only use
        your data to provide that service to us:
      </p>
      <ul>
        {PROVIDERS.map(([name, purpose]) => (
          <li key={name}>
            <strong>{name}</strong> — {purpose}.
          </li>
        ))}
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          Your account, videos, and clips: until you ask us to delete them or
          close your account.
        </li>
        <li>
          Purchase and credit records: as long as we need them for tax and
          accounting.
        </li>
        <li>
          Rate-limit records tied to your IP address or email: about a day.
        </li>
      </ul>

      <h2>Your choices and rights</h2>
      <p>
        Email <SupportEmail /> to get a copy of your data, correct it, or have
        your account and content deleted. We’ll answer within 30 days. Depending
        on where you live (for example, California), you may have further rights
        under local law; we honor them.
      </p>

      <h2>Security</h2>
      <p>
        Passwords are stored hashed, connections are encrypted, and your videos
        are only reachable through short-lived signed links issued to your
        account.
      </p>

      <h2>Children</h2>
      <p>
        {productName} isn’t for children under 13, and we don’t knowingly
        collect their information. Accounts require users to be 18 or older.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy materially, we’ll tell you by email or in the
        app before the change takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        {companyName}, <SupportEmail />.
      </p>
    </LegalPage>
  );
}
