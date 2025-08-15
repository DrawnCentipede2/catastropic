import SEO from "@/components/SEO";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Contact = () => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    location: "",
    category: "general",
    type: "feedback",
    subject: "",
    message: "",
  });

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.message) {
      toast({ title: "Missing required fields", description: "Please include your email and message." });
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        ...form,
        submitted_at: new Date().toISOString(),
      };
      // Simple MVP: send to a Formspree-like endpoint if configured, else mailto fallback
      const endpoint = (import.meta as any).env?.VITE_CONTACT_WEBHOOK_URL;
      if (endpoint) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        toast({ title: "Thanks!", description: "Your message has been sent." });
        setForm({ name: "", email: "", location: "", category: "general", type: "feedback", subject: "", message: "" });
      } else {
        const params = new URLSearchParams({
          subject: form.subject || `[${form.type}] ${form.category}`,
          body: `Name: ${form.name}\nEmail: ${form.email}\nLocation: ${form.location}\nType: ${form.type}\nCategory: ${form.category}\n\n${form.message}`,
        });
        window.location.href = `mailto:hello@catastropic.dev?${params.toString()}`;
      }
    } catch (err: any) {
      console.error("[contact] submit error", err);
      toast({ title: "Could not send", description: "Please try again later or email hello@catastropic.dev" });
    } finally {
      setSubmitting(false);
    }
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Contact Catastropic',
    url: `${window.location.origin}/contact`,
    description: 'Contact Catastropic for support, feedback, or partnerships.',
  };

  return (
    <main className="container py-10">
      <SEO title="Contact — Catastropic" description="Reach out to Catastropic for support, feedback, or inquiries." jsonLd={jsonLd} />
      <section className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Contact Us</CardTitle>
            <CardDescription>Send us your question, feedback, or report an issue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" value={form.name} onChange={onChange} placeholder="Your name" />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" name="email" type="email" value={form.email} onChange={onChange} placeholder="you@example.com" required />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" name="location" value={form.location} onChange={onChange} placeholder="City, Country" />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={v => setForm(prev => ({ ...prev, type: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feedback">Feedback</SelectItem>
                      <SelectItem value="issue">Issue</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="partnership">Partnership</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(prev => ({ ...prev, category: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="submission">Submission</SelectItem>
                      <SelectItem value="profile">Profile</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="feature">Feature request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" name="subject" value={form.subject} onChange={onChange} placeholder="Brief summary" />
                </div>
              </div>

              <div>
                <Label htmlFor="message">Message *</Label>
                <Textarea id="message" name="message" value={form.message} onChange={onChange} placeholder="Write your message..." required rows={6} />
              </div>

              <CardFooter className="px-0">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send message'}
                </Button>
              </CardFooter>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default Contact;


