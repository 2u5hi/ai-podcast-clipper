import { type Metadata } from "next";
import Link from "next/link";
import { LegalPage, SupportEmail } from "~/components/legal-page";
import { BRAND } from "~/config/brand";

export const metadata: Metadata = {
  title: `Terms of Service · ${BRAND.productName}`,
};

const { productName, companyName, governingLaw } = BRAND;

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are an agreement between you and {companyName} (“we”, “us”),
        which runs {productName}. By creating an account or using {productName},
        you agree to them. If you don’t agree, don’t use the service.
      </p>

      <h2>1. What {productName} does</h2>
      <p>
        {productName} turns videos you upload into short vertical clips: it
        transcribes the audio, uses AI to choose moments, reframes them to 9:16,
        and adds captions and, where these terms say so, a watermark.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be at least 18, or the age of majority where you live.</li>
        <li>
          Give a real email address and keep your password to yourself. You’re
          responsible for what happens under your account.
        </li>
        <li>
          One person per account, and one account per person. Creating extra
          accounts to collect free credits isn’t allowed.
        </li>
      </ul>

      <h2>3. Your content</h2>
      <ul>
        <li>
          You keep ownership of the videos you upload and the clips made from
          them.
        </li>
        <li>
          You give us permission to store, copy, transcribe, process, and
          display your content only as needed to run {productName} for you,
          including sending transcripts to the service providers listed in our{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </li>
        <li>
          <strong>
            You may only upload content you own or have permission to use.
          </strong>{" "}
          You’re responsible for having the rights to everything you upload and
          to anything you post using our clips.
        </li>
        <li>
          Don’t upload content that is illegal, infringes someone else’s rights,
          sexualizes minors, harasses or threatens people, or that you otherwise
          have no right to share.
        </li>
      </ul>

      <h2>4. Copyright complaints</h2>
      <p>
        If you believe content on {productName} infringes your copyright, email{" "}
        <SupportEmail /> with: your contact details; the work you say is
        infringed; where the content is on our service; a statement that you
        believe in good faith the use isn’t authorized; and a statement, under
        penalty of perjury, that your notice is accurate and that you are the
        owner or authorized to act for them, with your physical or electronic
        signature. We remove infringing content and close the accounts of repeat
        infringers.
      </p>

      <h2>5. Credits and payment</h2>
      <ul>
        <li>
          You buy credits in packs, paid through Stripe. One credit is one
          finished clip, and each video makes up to five clips.
        </li>
        <li>
          When a video starts processing, up to five credits are set aside. Any
          that don’t become clips — because processing failed or found fewer
          moments — are returned automatically.
        </li>
        <li>
          Credits don’t expire, have no cash value, and can’t be transferred or
          sold.
        </li>
        <li>
          Prices are shown on our{" "}
          <Link href="/pricing" className="underline underline-offset-4">
            pricing page
          </Link>
          . We may change them; changes don’t affect credits you’ve already
          bought.
        </li>
        <li>
          Refunds are covered by our{" "}
          <Link href="/refunds" className="underline underline-offset-4">
            Refund Policy
          </Link>
          .
        </li>
      </ul>

      <h2>6. Watermarks</h2>
      <p>
        Clips made by accounts that haven’t bought credits carry the{" "}
        {BRAND.houseWatermark} watermark. Once you’ve bought any credit pack,
        your clips carry your own watermark text, or none, at no extra cost.
      </p>

      <h2>7. AI output</h2>
      <p>
        Moment selection, transcription, captions, and framing are automated and
        can be wrong: a caption may mishear a word, or a clip may start
        mid-sentence. Review clips before you publish them. You decide what to
        post and are responsible for it.
      </p>

      <h2>8. Using the service fairly</h2>
      <p>
        Don’t try to break, overload, scrape, or reverse-engineer {productName},
        get around its limits, access other people’s accounts or content, or use
        it to build a competing service.
      </p>

      <h2>9. Ending your use</h2>
      <p>
        You can stop using {productName} at any time; to have your account and
        content deleted, email <SupportEmail />. We may suspend or close
        accounts that break these terms. If we close your account for reasons
        other than a breach, we’ll refund unused purchased credits.
      </p>

      <h2>10. Disclaimers and liability</h2>
      <p>
        {productName} is provided “as is” and “as available”, without warranties
        of any kind, to the extent the law allows. We aren’t liable for
        indirect, incidental, or consequential losses, or for lost profits or
        data. Our total liability for any claim about the service is limited to
        what you paid us in the 12 months before the claim.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These terms are governed by the laws of {governingLaw}, without regard
        to conflict-of-law rules. Disputes will be resolved in the state or
        federal courts located in Fulton County, Georgia, and you and we consent
        to their jurisdiction.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update these terms. For material changes, we’ll tell you by email
        or in the app before they take effect; continuing to use {productName}{" "}
        after that means you accept them.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these terms: <SupportEmail />.
      </p>
    </LegalPage>
  );
}
