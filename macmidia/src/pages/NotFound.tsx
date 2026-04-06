import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center gradient-bg">
      <div className="text-center glass-card p-12 max-w-md animate-scale-in">
        <div className="text-7xl font-black gradient-text mb-4">404</div>
        <p className="text-lg text-muted-foreground mb-6">Página não encontrada</p>
        <a href="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm btn-primary-glow">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao início
        </a>
      </div>
    </div>
  );
};

export default NotFound;
