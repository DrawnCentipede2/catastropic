import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <section className="text-center">
        <h1 className="text-5xl font-bold mb-4">404</h1>
        <p className="text-lg text-muted-foreground mb-4">Oops! Page not found</p>
        <a href="/" className="underline hover:no-underline">Return to Home</a>
      </section>
    </main>
  );
};

export default NotFound;
