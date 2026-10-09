import { type Metadata } from "next";
import {
  LegalPage,
  REFUND_WINDOW_DAYS,
  SupportEmail,
} from "~/components/legal-page";
import { BRAND } from "~/config/brand";

export const metadata: Metadata = {
  title: `Refund Policy · ${BRAND.productName}`,
};

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy">
      <h2>Credits come back automatically</h2>
      <p>
        You don’t need to ask for these. When a video finishes, you’re charged
        one credit per clip you actually got, and the rest of what was set aside
        comes straight back to your balance:
      </p>
      <ul>
        <li>If processing fails, all of its credits are returned.</li>
        <li>
          If no clip-worthy moments are found, all of its credits are returned.
        </li>
        <li>
          If fewer clips are made than were set aside, the difference is
          returned.
        </li>
      </ul>

      <h2>Refunds of credit packs</h2>
      <ul>
        <li>
          If you haven’t used any credits from a pack, you can get a full refund
          within {REFUND_WINDOW_DAYS} days of buying it.
        </li>
        <li>
          Once credits from a pack have been used, that pack isn’t refundable,
          unless something went wrong on our side or the law requires a refund.
        </li>
        <li>
          If we close your account for reasons other than a breach of our terms,
          we refund your unused purchased credits.
        </li>
      </ul>

      <h2>How to ask</h2>
      <p>
        Email <SupportEmail /> from the address on your account, with the date
        of the purchase. Approved refunds go back to the original payment method
        through Stripe and usually arrive within 5–10 business days.
      </p>
      <p>
        If something looks wrong with a charge, please contact us before
        disputing it with your bank; we can usually fix it faster.
      </p>
    </LegalPage>
  );
}
