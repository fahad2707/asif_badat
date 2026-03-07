import { redirect } from 'next/navigation';

export default function HomePage() {
  // Use /store as home so the site always loads on deploy (e.g. Render).
  // To use the static landing again, switch to: redirect('/landing.html');
  redirect('/store');
}
