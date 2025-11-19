import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import LoginScreen from "./pages/LoginScreen";
import ImagesLibraryPage from "./pages/ImagesLibraryPage";
import PromptsLibraryPage from "./pages/PromptsLibraryPage";
import CategoryManagementPage from "./pages/CategoryManagementPage";
import { useState, useEffect } from "react";

function Router() {
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string; profileImageUrl: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check localStorage for saved user on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('currentUser');
      }
    }
    setIsLoading(false);
  }, []);

  const handleLoginSuccess = (user: { id: number; username: string; profileImageUrl: string | null }) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-blue-900 text-xl">Se încarcă...</div>
      </div>
    );
  }

  // If not logged in, show login screen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // If logged in, show main app
  return (
    <Switch>
      <Route path={"/"} component={() => <Home currentUser={currentUser} onLogout={handleLogout} />} />
      <Route path={"/images-library"} component={() => <ImagesLibraryPage currentUser={currentUser} />} />
      <Route path={"/prompts-library"} component={() => <PromptsLibraryPage currentUser={currentUser} />} />
      <Route path={"/category-management"} component={() => <CategoryManagementPage currentUser={currentUser} />} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
