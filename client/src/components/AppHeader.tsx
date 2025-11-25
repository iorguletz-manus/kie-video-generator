import { useLocation } from "wouter";
import { Sparkles, Images, MessageSquare, Folder, Settings as SettingsIcon, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppHeaderProps {
  currentUser: {
    id: number;
    username: string;
    profileImageUrl?: string | null;
  };
  onLogout: () => void;
  onOpenSettings?: () => void;
}

export default function AppHeader({ currentUser, onLogout, onOpenSettings }: AppHeaderProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg">
      <div className="container max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Brand */}
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-6 h-6 text-yellow-300" />
            <span className="text-white font-bold text-lg">A.I Ads Engine</span>
          </button>
          
          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={() => setLocation("/images-library")}
              className="flex items-center gap-2 text-white hover:text-yellow-300 transition-colors text-sm font-medium"
            >
              <Images className="w-4 h-4" />
              Images Library
            </button>
            <button
              onClick={() => setLocation("/prompts-library")}
              className="flex items-center gap-2 text-white hover:text-yellow-300 transition-colors text-sm font-medium"
            >
              <MessageSquare className="w-4 h-4" />
              Prompts Library
            </button>
            <button
              onClick={() => setLocation("/category-management")}
              className="flex items-center gap-2 text-white hover:text-yellow-300 transition-colors text-sm font-medium"
            >
              <Folder className="w-4 h-4" />
              Ads Management
            </button>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-2 text-white hover:text-yellow-300 transition-colors text-sm font-medium"
              >
                <SettingsIcon className="w-4 h-4" />
                Settings
              </button>
            )}
          </div>
          
          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-800 transition-colors">
                {currentUser.profileImageUrl && (
                  <img
                    src={currentUser.profileImageUrl}
                    alt="Profile"
                    className="w-8 h-8 rounded-full border-2 border-white object-cover"
                  />
                )}
                {!currentUser.profileImageUrl && (
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-800 flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {currentUser.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-white text-sm font-medium">{currentUser.username}</span>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
