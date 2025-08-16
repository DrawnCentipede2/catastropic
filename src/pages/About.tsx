import SEO from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Users, 
  Shield, 
  Heart, 
  Github, 
  Mail, 
  MessageCircle, 
  BookOpen,
  Code,
  Puzzle,
  Globe,
  Star
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const About = () => {
  const location = useLocation();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About Catastropic',
    url: `${window.location.origin}/about`,
    description: 'Learn about Catastropic, the community hub for Model Context Protocol servers.',
  };

  // Smooth-scroll to hash anchors (supports SPA navigation)
  useEffect(() => {
    const hash = (location.hash || '').replace(/^#/, '');
    if (!hash) return;
    const scroll = () => {
      const el = document.getElementById(decodeURIComponent(hash));
      if (el && 'scrollIntoView' in el) {
        (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    // Delay slightly to ensure content is rendered
    const t = setTimeout(scroll, 60);
    return () => clearTimeout(t);
  }, [location.hash]);

  return (
    <main className="container py-10">
      <SEO
        title="About — Catastropic"
        description="Learn about Catastropic, the community hub for Model Context Protocol servers. Discover how MCP works, our mission, and community guidelines."
        jsonLd={jsonLd}
      />
      
      {/* Hero Section */}
      <section className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
          About Catastropic
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          The community hub for discovering, sharing, and monetizing Model Context Protocol servers. 
          Built by developers, for developers.
        </p>
      </section>

      {/* Mission Section */}
      <section className="mb-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight mb-4">Our Mission</h2>
            <p className="text-lg text-muted-foreground mb-6">
              We believe AI should be accessible, extensible, and community-driven. Catastropic empowers 
              developers to build, share, and monetize MCP servers that extend AI capabilities in meaningful ways.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-full p-2">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium">Accelerate AI development</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-full p-2">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium">Foster community collaboration</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-full p-2">
                  <Heart className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium">Support creator economy</span>
              </div>
            </div>
          </div>
          <div className="bg-secondary/50 rounded-xl p-8 border">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-primary" />
                <span className="font-medium">Created by Anthropic</span>
              </div>
              <p className="text-sm text-muted-foreground">
                The Model Context Protocol was developed by Anthropic as an open standard to enable 
                secure, standardized connections between AI applications and external data sources.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <BookOpen className="h-5 w-5 text-primary" />
                <span className="font-medium">Open Source Standard</span>
              </div>
              <p className="text-sm text-muted-foreground">
                MCP is freely available for developers to implement, ensuring widespread adoption 
                and community-driven innovation in AI tooling.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Separator className="mb-16" />

      {/* What is MCP Section */}
      <section className="mb-16 scroll-mt-24" id="what-is-mcp">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight mb-4">What is Model Context Protocol?</h2>
          <p className="text-lg text-muted-foreground max-w-4xl mx-auto">
            The Model Context Protocol (MCP) is an open standard created by Anthropic that enables AI applications 
            to securely connect with external data sources, tools, and services through a unified protocol. 
            Think of it as a universal translator that allows AI systems to interact with any external resource 
            in a standardized, secure way.
          </p>
        </div>
        
        {/* History Section */}
        <div className="mb-12 bg-secondary/30 rounded-xl p-8 border scroll-mt-24" id="mcp-story">
          <h3 className="text-xl font-semibold mb-4 text-center">The Story Behind MCP</h3>
          <div className="max-w-3xl mx-auto text-muted-foreground space-y-4">
            <p>
              Anthropic, the AI safety company behind Claude, recognized a fundamental challenge in AI development: 
              each AI application required custom integrations for every external service it wanted to access. 
              This led to fragmented, insecure, and difficult-to-maintain connections.
            </p>
            <p>
              In response, Anthropic developed the Model Context Protocol as an open standard that would solve this 
              problem once and for all. By creating a universal protocol, they enabled any AI application to connect 
              to any service that implements MCP, dramatically simplifying AI development and improving security.
            </p>
            <p className="text-center font-medium text-foreground">
              MCP represents Anthropic's commitment to building AI infrastructure that benefits the entire ecosystem, 
              not just their own products.
            </p>
          </div>
        </div>
        
        {/* How to Use MCP */}
        <div className="mb-12">
          <h3 className="text-2xl font-semibold mb-6 text-center">How to Use MCP</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold mb-3">For AI Application Developers</h4>
                <div className="space-y-2 text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <p className="text-sm">Install an MCP client library in your preferred language</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <p className="text-sm">Connect to MCP servers that provide the functionality you need</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <p className="text-sm">Your AI can now access external tools and data through the standardized protocol</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold mb-3">For Service Providers</h4>
                <div className="space-y-2 text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <p className="text-sm">Build an MCP server that exposes your service's capabilities</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <p className="text-sm">Implement the standard MCP protocol for authentication and data exchange</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <p className="text-sm">Any AI application can now integrate with your service instantly</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                Universal Protocol
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                A standardized way for AI applications to communicate with external services, 
                databases, APIs, and tools without requiring custom integrations for each connection.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Secure by Design
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Built-in authentication, authorization, and sandboxing ensure that AI systems 
                can safely access external resources while maintaining strict security boundaries.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Puzzle className="h-5 w-5 text-primary" />
                Infinitely Extensible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Developers can create custom MCP servers for any service, tool, or data source, 
                making AI applications endlessly adaptable to new use cases and requirements.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="mb-16">
        <h2 className="text-3xl font-semibold tracking-tight mb-8 text-center">How Catastropic Works</h2>
        
        <div className="space-y-8">
          <div className="flex items-start gap-6">
            <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-semibold flex-shrink-0">
              1
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Discover MCP Servers</h3>
              <p className="text-muted-foreground">
                Browse our curated collection of MCP servers across categories like productivity, 
                development tools, data sources, and more. Use filters and search to find exactly what you need.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-6">
            <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-semibold flex-shrink-0">
              2
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Vote & Review</h3>
              <p className="text-muted-foreground">
                Help the community by voting for quality servers and leaving detailed reviews. 
                The weekly leaderboard showcases the most popular and trusted MCP servers.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-6">
            <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-semibold flex-shrink-0">
              3
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Share Your Creations</h3>
              <p className="text-muted-foreground">
                Built something amazing? Submit your MCP server with demos, documentation, and pricing. 
                Our monetization tools help you turn your work into sustainable income.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Separator className="mb-16" />

      {/* Community Guidelines */}
      <section className="mb-16">
        <h2 className="text-3xl font-semibold tracking-tight mb-8">Community Guidelines</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <Star className="h-5 w-5" />
                Do's
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-600 mt-2 flex-shrink-0"></div>
                <p className="text-sm">Submit well-documented, tested MCP servers</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-600 mt-2 flex-shrink-0"></div>
                <p className="text-sm">Provide clear installation instructions and examples</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-600 mt-2 flex-shrink-0"></div>
                <p className="text-sm">Be respectful and constructive in reviews and feedback</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-600 mt-2 flex-shrink-0"></div>
                <p className="text-sm">Report security vulnerabilities responsibly</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-600 mt-2 flex-shrink-0"></div>
                <p className="text-sm">Credit original authors and respect licenses</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Shield className="h-5 w-5" />
                Don'ts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-600 mt-2 flex-shrink-0"></div>
                <p className="text-sm">Submit malicious, broken, or poorly maintained servers</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-600 mt-2 flex-shrink-0"></div>
                <p className="text-sm">Spam the platform with duplicate or low-quality submissions</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-600 mt-2 flex-shrink-0"></div>
                <p className="text-sm">Manipulate votes or reviews through fake accounts</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-600 mt-2 flex-shrink-0"></div>
                <p className="text-sm">Violate intellectual property rights or licenses</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-600 mt-2 flex-shrink-0"></div>
                <p className="text-sm">Engage in harassment or discriminatory behavior</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Section */}
      <section>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Get in Touch
            </CardTitle>
            <CardDescription>
              Have questions, suggestions, or need support? We'd love to hear from you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div className="space-y-2">
                <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-medium">Email</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  For support, partnerships, or general inquiries
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/contact">
                    Contact Us
                  </Link>
                </Button>
              </div>
              
              <div className="space-y-2 opacity-60 select-none">
                <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-medium">Documentation</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Work in progress — docs are not available yet
                </p>
                <Button variant="outline" size="sm" disabled>Read Docs</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default About;