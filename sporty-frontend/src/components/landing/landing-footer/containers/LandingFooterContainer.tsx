import Link from "next/link";

export function LandingFooterContainer() {
  return (
    <footer className="bg-black" aria-labelledby="landing-footer-title" id="pricing">
      <div className="mx-auto w-full max-w-7xl px-4 pb-12 pt-14 sm:px-6 lg:px-8 lg:pb-14 lg:pt-16">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 id="landing-footer-title" className="font-display text-sm font-bold tracking-wide text-[#F4F4F9]">About</h3>
            <p className="mt-3 text-sm leading-6 text-[#F4F4F9]/60">
              Sporty helps fantasy managers run teams across football, basketball, and cricket.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold tracking-wide text-[#F4F4F9]">Features</h4>
            <ul className="mt-3 space-y-2 text-sm text-[#F4F4F9]/60">
              <li><Link href="/#features" className="hover:text-primary hover:no-underline transition-colors">Multi-sport leagues</Link></li>
              <li><Link href="/#how-it-works" className="hover:text-primary hover:no-underline transition-colors">Lineup tools</Link></li>
              <li><Link href="/dashboard" className="hover:text-primary hover:no-underline transition-colors">Live leaderboard</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold tracking-wide text-[#F4F4F9]">Support</h4>
            <ul className="mt-3 space-y-2 text-sm text-[#F4F4F9]/60">
              <li><Link href="/support" className="hover:text-primary hover:no-underline transition-colors">Help Center</Link></li>
              <li><Link href="/terms" className="hover:text-primary hover:no-underline transition-colors">Terms</Link></li>
              <li><Link href="/privacy" className="hover:text-primary hover:no-underline transition-colors">Privacy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold tracking-wide text-[#F4F4F9]">Social</h4>
            <ul className="mt-3 space-y-2 text-sm text-[#F4F4F9]/60">
              <li><Link href="https://twitter.com" className="hover:text-primary hover:no-underline transition-colors">Twitter</Link></li>
              <li><Link href="https://instagram.com" className="hover:text-primary hover:no-underline transition-colors">Instagram</Link></li>
              <li><Link href="https://youtube.com" className="hover:text-primary hover:no-underline transition-colors">YouTube</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-sm text-[#F4F4F9]/40">
          <p>© 2026 Sporty. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
