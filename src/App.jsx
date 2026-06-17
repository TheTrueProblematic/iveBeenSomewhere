import { useState, useEffect } from 'react'
import { Guitar, Route } from 'lucide-react'
import MapTracker from './components/MapTracker'
import ListTracker from './components/ListTracker'
import PlaceModal from './components/PlaceModal'
import Leaderboard from './components/Leaderboard'
import ProgressBanner from './components/ProgressBanner'
import AuthModal from './components/AuthModal'
import { auth, isTestMode } from './firebase'
import { signOut } from 'firebase/auth'
import { useStore } from './store'

function App() {
  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const { visitedPlaces, user, authModalOpen, setAuthModalOpen } = useStore();

  useEffect(() => {
    fetch('/places.json')
      .then(res => res.json())
      .then(data => setPlaces(data))
      .catch(err => console.error("Error loading places:", err));
  }, []);

  const percentVisited = places.length > 0 ? (visitedPlaces.size / places.length) * 100 : 0;

  let title = "You've Been Nowhere";
  if (percentVisited > 0 && percentVisited < 100) {
    title = "You've Been Somewhere";
  } else if (percentVisited === 100) {
    title = "You've Been Everywhere";
  }

  return (
    <div className="relative min-h-screen pb-24 font-sans overflow-x-hidden">
      {/* Aged-paper backdrop: the tan color base, a worn-paper texture
          multiplied onto it, warm light and a soft vignette */}
      <div className="fixed inset-0 -z-10 overflow-hidden bg-paper-gradient">
        <div
          className="absolute inset-0 mix-blend-multiply"
          style={{
            backgroundImage: "url('/WornPaperTexture.webp')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.5,
          }}
        />
        <div className="absolute -top-1/4 left-1/2 h-[70vh] w-[120vw] -translate-x-1/2 rounded-full bg-brass/15 blur-[120px] animate-float-slow" />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(130% 90% at 50% -10%, transparent 60%, rgba(33,28,24,0.18) 100%)' }}
        />
      </div>

      {/* Header — the Man in Black marquee */}
      <header className="sticky top-0 z-20 border-b-2 border-brass/40 bg-ink/95 text-paper-light backdrop-blur-md shadow-card">
        <div className="container mx-auto max-w-7xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-brass-gradient text-ink shadow-glow ring-1 ring-gold/40">
              <Guitar className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl md:text-4xl font-bold uppercase tracking-[0.08em] text-paper-light transition-all duration-500">
                {title}
              </h1>
              <p className="hidden sm:flex items-center gap-1.5 font-typewriter text-xs md:text-sm tracking-wide text-brass">
                <Route className="h-3.5 w-3.5 text-brass" />
                Everywhere&hellip;according to Johnny Cash
              </p>
            </div>
          </div>

          {user ? (
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 rounded-md border border-brass/30 bg-coal/80 py-1.5 pl-1.5 pr-4">
                <span className="grid h-8 w-8 place-items-center rounded-sm bg-brass-gradient font-display text-sm font-bold text-ink">
                  {(user.displayName || '?').charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:block font-typewriter text-sm">
                  <span className="text-paper/60">Howdy, </span>
                  <span className="font-bold text-paper-light">{user.displayName}</span>
                </span>
              </div>
              <button
                onClick={() => {
                  if (!isTestMode) {
                    signOut(auth).catch(err => console.error("Logout error:", err));
                  } else {
                    alert("Running in test mode. Logout disabled.");
                  }
                }}
                className="rounded-md border border-oxblood/40 bg-oxblood/10 px-3 py-1.5 font-display text-xs md:text-sm font-semibold uppercase tracking-wider text-paper-light hover:bg-oxblood/35 hover:text-white transition-all active:scale-95"
              >
                Log Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="rounded-md bg-brass-gradient px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-ink shadow-glow hover:brightness-105 active:scale-95 transition-all shrink-0"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="container mx-auto p-4 max-w-7xl mt-6 space-y-6">
        <ProgressBanner
          percent={percentVisited}
          visitedCount={visitedPlaces.size}
          total={places.length}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Map */}
          <div className="lg:col-span-2">
            <MapTracker places={places} onSelectPlace={setSelectedPlace} />
          </div>

          {/* Right Column: List */}
          <div className="flex flex-col gap-6">
            <ListTracker places={places} onSelectPlace={setSelectedPlace} />
          </div>
        </div>

        {/* Full-width Hall of Fame */}
        <Leaderboard />
      </main>

      <PlaceModal
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      <footer className="fixed bottom-0 left-0 w-full text-center py-3 bg-ink/95 backdrop-blur-md border-t-2 border-brass/40" style={{ zIndex: 10 }}>
        <a id="footer-link" href="https://maximilianmcclelland.com" style={{ textDecoration: 'none' }} className="font-typewriter text-sm tracking-wide transition-colors duration-1000 text-brass hover:text-gold">
          TrueProblematic &copy; <span id="footer-year">{new Date().getFullYear()}</span>
        </a>
      </footer>
    </div>
  )
}

export default App
