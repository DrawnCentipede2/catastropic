const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t mt-12">
      <div className="container py-8 grid gap-4 md:grid-cols-2 items-center">
        <p className="text-sm text-muted-foreground">
          © {year} Catastropic — Discover, vote, and monetize Model Context Protocol servers.
        </p>
        <nav className="justify-self-end flex gap-4 text-sm">
          <a href="https://www.anthropic.com/" target="_blank" rel="noreferrer" className="hover:underline">Anthropic</a>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
