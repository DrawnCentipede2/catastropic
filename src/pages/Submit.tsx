import SEO from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useSubmitServer, useSubmissionVerification } from "@/hooks/useServers";
import { serverApi } from "@/services/api";

const Submit = () => {
  const { isAuthenticated, profile, login } = useAuth() as any;
  const submitServer = useSubmitServer();
  const verify = useSubmissionVerification();

  const [repoUrl, setRepoUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const totalChecks = 8;
  const [completedChecks, setCompletedChecks] = useState(0);
  const inc = () => setCompletedChecks((c) => Math.min(totalChecks, c + 1));
  const stepDelay = 375; // ~3s total for 8 steps
  const step = async () => { inc(); await new Promise(res => setTimeout(res, stepDelay)); };
  const [checks, setChecks] = useState<{
    repoExists: boolean | null;
    isGithubUrl: boolean | null;
    mentionsMcp: boolean | null;
    hasMcpDependency: boolean | null;
    notArchived: boolean | null;
    hasLicense: boolean | null;
    readmeSufficient: boolean | null;
    recentlyUpdated: boolean | null;
    hasEnvFiles: boolean | null;
    hasEnvLocal: boolean | null;
    possibleSecrets: boolean | null;
    isInaccessible: boolean | null;
  }>({ repoExists: null, isGithubUrl: null, mentionsMcp: null, hasMcpDependency: null, notArchived: null, hasLicense: null, readmeSufficient: null, recentlyUpdated: null, hasEnvFiles: null, hasEnvLocal: null, possibleSecrets: null, isInaccessible: null });
  const [hadExtraPath, setHadExtraPath] = useState(false);
  const [envFilesFound, setEnvFilesFound] = useState<string[]>([]);
  const [hasValidated, setHasValidated] = useState(false);
  const [extracted, setExtracted] = useState<{
    owner?: string;
    repo?: string;
    name?: string;
    description?: string;
  }>({});
  const [ownerCode, setOwnerCode] = useState<string | null>(null);
  const [ownerVerifyLoading, setOwnerVerifyLoading] = useState(false);
  const [validatedOk, setValidatedOk] = useState(false);
  const [needsOwnerProof, setNeedsOwnerProof] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const parseOwnerRepo = (url: string): { owner: string; repo: string } | null => {
    try {
      const m = url.match(/github\.com\/(.+?)\/(.+?)(?:$|\?|#|\/)/i);
      if (!m) return null;
      return { owner: m[1], repo: m[2].replace(/\.git$/i, "") };
    } catch { return null; }
  };

  const validateRepo = async (): Promise<boolean> => {
    const isGithub = /github\.com\//i.test(repoUrl.trim());
    setChecks(prev => ({ ...prev, isGithubUrl: isGithub }));
    if (!isGithub) {
      toast({ title: "Invalid URL", description: "Please enter a GitHub repository URL.", variant: "destructive" });
      return false;
    }
    // Count: Valid GitHub URL
    await step();

    const parsed = parseOwnerRepo(repoUrl.trim());
    if (!parsed) {
      toast({ title: "Cannot parse repository", description: "Use a full repo URL like https://github.com/owner/repo", variant: "destructive" });
      return;
    }

    setIsValidating(true);
    try { console.debug('[validate] start', { url: repoUrl.trim() }) } catch {}
    setCompletedChecks(0);
    try {
      // Duplicate pre-checks (approved or pending) via Supabase
      try {
        const trimmed = repoUrl.trim()
        const existsApproved = await serverApi.findServerByRepoUrl(trimmed).catch(() => null)
        if (existsApproved) {
          toast({ title: 'Already submitted', description: 'This repository is already in the directory.', variant: 'destructive' })
          setChecks(prev => ({ ...prev, repoExists: true }))
          return false
        }
        const existsPending = await serverApi.findSubmissionByRepoUrl(trimmed).catch(() => null)
        if (existsPending) {
          toast({ title: 'Already being reviewed', description: 'This repository is already being submitted.', variant: 'destructive' })
          setChecks(prev => ({ ...prev, repoExists: true }))
          return false
        }
      } catch {}
      // 1) Fetch repo metadata
      const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`
      let repoRes: Response
      try {
        repoRes = await fetch(apiUrl)
        try { console.debug('[validate] api.repo status', { apiUrl, status: repoRes.status }) } catch {}
      } catch (e: any) {
        try { console.error('[validate] api.repo fetch error', { apiUrl, message: e?.message }) } catch {}
        // create a Response-like object to drop into fallback
        // @ts-ignore
        repoRes = { ok: false, status: 0 }
      }
      // Fallback handler for GitHub API rate limits (403) or blocked API, using HTML and raw files
      const tryFallbackWithoutAPI = async () => {
        try { console.debug('[validate:fallback] start (api 403 or failed)') } catch {}
        // Try raw README/package.json on common branches to infer public existence (CORS-friendly)
        const branches = ['main', 'master']
        let repoPubliclyReachable = false
        let mentionsMcp = false
        let readmeSufficient = false
        let hasMcpDependency = false

        for (const br of branches) {
          try {
            const url = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${br}/README.md`
            const rm = await fetch(url)
            try { console.debug('[validate:fallback] README fetch', { url, status: rm.status }) } catch {}
            if (rm.ok) {
              repoPubliclyReachable = true
              const content = await rm.text()
              mentionsMcp = /\b(mcp|model\s*context\s*protocol)\b/i.test(content)
              readmeSufficient = content.trim().length >= 200
              break
            }
          } catch (e: any) {
            try { console.error('[validate:fallback] README fetch error', { branch: br, message: e?.message }) } catch {}
          }
        }

        // If README not found, try package.json to both infer existence and check deps
        for (const br of branches) {
          try {
            const url = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${br}/package.json`
            const pj = await fetch(url)
            try { console.debug('[validate:fallback] package.json fetch', { url, status: pj.status }) } catch {}
            if (pj.ok) {
              repoPubliclyReachable = true
              const text = await pj.text()
              try {
                const pkg = JSON.parse(text)
                const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } as Record<string, string>
                hasMcpDependency = Object.keys(deps).some(k => /model[- ]?context[- ]?protocol|@modelcontextprotocol\/.*/i.test(k))
              } catch (e: any) {
                try { console.error('[validate:fallback] package.json parse error', { message: e?.message }) } catch {}
              }
              break
            }
          } catch (e: any) {
            try { console.error('[validate:fallback] package.json fetch error', { branch: br, message: e?.message }) } catch {}
          }
        }

        if (!repoPubliclyReachable) {
          setChecks(prev => ({ ...prev, repoExists: false, isInaccessible: true }))
          toast({ title: 'Repository inaccessible', description: 'We could not verify access due to GitHub rate limits and no readable raw files.', variant: 'destructive' })
          try { console.warn('[validate:fallback] repo not publicly reachable via raw paths') } catch {}
          return false
        }

        // Mark as exists but skip API-only fields
        setChecks(prev => ({ ...prev, repoExists: true, isInaccessible: false }))
        await step() // repository exists

        // Unknown archived/license/updated in fallback
        setChecks(prev => ({ ...prev, notArchived: null, hasLicense: null, recentlyUpdated: null }))
        await step() // not archived (unknown)
        await step() // license (unknown)

        setChecks(prev => ({ ...prev, mentionsMcp, readmeSufficient }));
        await step(); // README mentions MCP
        await step(); // README length OK

        setChecks(prev => ({ ...prev, hasMcpDependency }));
        await step(); // MCP dependency present (fallback)

        // Env/secret scan skipped in fallback (unknown)
        setChecks(prev => ({ ...prev, hasEnvFiles: null, hasEnvLocal: null, possibleSecrets: null }));
        await step(); // secrets scan placeholder

        // Minimal extraction
        setExtracted({ owner: parsed.owner, repo: parsed.repo, name: parsed.repo, description: '' });

        // In fallback we don't know archived state; do not block unless explicitly known bad
        const requiredOk = !!(isGithub) && (mentionsMcp || hasMcpDependency);
        try { console.debug('[validate:fallback] result', { requiredOk, mentionsMcp, hasMcpDependency }) } catch {}
        setValidatedOk(requiredOk);
        toast({ title: "Validation complete (limited)", description: "GitHub API rate-limited. Performed limited checks via public sources." });
        return requiredOk;
      };

      if (!repoRes.ok) {
        if (repoRes.status === 403 || repoRes.status === 0) {
          const ok = await tryFallbackWithoutAPI();
          setIsValidating(false);
          setHasValidated(true);
          return ok;
        }
        setChecks(prev => ({ ...prev, repoExists: false, isInaccessible: true }));
        toast({ title: "Repository inaccessible", description: "The repository may be private or not found. Make it public or grant access.", variant: "destructive" });
        return false;
      }
      const repoJson: any = await repoRes.json();
      try { console.debug('[validate] api.repo json keys', Object.keys(repoJson || {})) } catch {}
      // Count: Repository exists
      await step();
      // Normalize deep links: enforce repository root URL for MVP
      const extraPath = /github\.com\/[^/]+\/[^/]+\/.+/.test(repoUrl.trim());
      if (extraPath) {
        setHadExtraPath(true);
        if (repoJson?.html_url) setRepoUrl(repoJson.html_url);
      }
      const archived = !!repoJson?.archived;
      const hasLicense = !!repoJson?.license;
      const pushedAt = repoJson?.pushed_at ? new Date(repoJson.pushed_at) : null;
      const recentlyUpdated = pushedAt ? (Date.now() - pushedAt.getTime() < 365 * 24 * 60 * 60 * 1000) : false;
      setChecks(prev => ({ ...prev, repoExists: true, isInaccessible: false, notArchived: !archived, hasLicense, recentlyUpdated }));
      // Count: Not archived
      await step();
      // Count: License present
      await step();

      // 1a) Quick repository tree scan for .env files (protect users)
      try {
        const branch = repoJson?.default_branch || 'main';
        const treeRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`);
        if (treeRes.ok) {
          const treeJson: any = await treeRes.json();
          const paths: string[] = Array.isArray(treeJson?.tree) ? treeJson.tree.map((n: any) => n?.path).filter(Boolean) : [];
          const envRe = /(^|\/)\.env(\..+)?$/i;
          const found = paths.filter(p => envRe.test(p));
          setEnvFilesFound(found);
          const hasEnv = found.length > 0;
          const hasEnvLocal = found.some(p => /(^|\/)\.env\.local$/i.test(p));
          setChecks(prev => ({ ...prev, hasEnvFiles: hasEnv, hasEnvLocal }));

          // Shallow secret scan on first few env files
          if (found.length > 0) {
            // Prefer scanning real env files over examples/templates
            const isExampleEnv = (p: string) => /(^|\/)example\.env$/i.test(p) || /\.env\.(example|sample|template)$/i.test(p);
            const realEnv = found.filter(p => !isExampleEnv(p));
            const toScan = (realEnv.length > 0 ? realEnv : found).slice(0, 3);
            const secretRegexes: RegExp[] = [
              /ghp_[A-Za-z0-9]{20,}/i, // GitHub personal token
              /sk-[A-Za-z0-9-_]{20,}/i, // OpenAI/Stripe style secret
              /AKIA[0-9A-Z]{16}/, // AWS access key id
              /AIza[0-9A-Za-z-_]{35}/, // Google API key
              /(service[_-]?role|anon|api[_-]?key)[^\n=]{0,40}[=:\s][A-Za-z0-9-_\.]{20,}\b/i, // generic
            ];
            let secrets = false;
            for (const p of toScan) {
              try {
                const contRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${encodeURIComponent(p)}?ref=${encodeURIComponent(branch)}`);
                if (!contRes.ok) continue;
                const contJson: any = await contRes.json();
                const text = typeof contJson?.content === 'string' ? atob(contJson.content) : '';
                if (secretRegexes.some(rx => rx.test(text))) { secrets = true; break; }
              } catch {}
            }
            setChecks(prev => ({ ...prev, possibleSecrets: secrets }));
            // Count: No potential secrets detected (completed scan regardless of result)
            await step();
          } else {
            setChecks(prev => ({ ...prev, possibleSecrets: false }));
            // Count: No potential secrets detected (no env files)
            await step();
          }
        }
      } catch {}
      setExtracted({
        owner: repoJson?.owner?.login || parsed.owner,
        repo: repoJson?.name || parsed.repo,
        name: repoJson?.name || parsed.repo,
        description: repoJson?.description || "",
      });

      // 2) README check for MCP mentions
      let mentionsMcp = false;
      let readmeSufficient = false;
      try {
        const readmeRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/readme`);
        if (readmeRes.ok) {
          const readmeJson: any = await readmeRes.json();
          const content = typeof readmeJson?.content === "string" ? atob(readmeJson.content) : "";
          // prepare enrichment for DB
          setExtracted(prev => ({ ...prev, description: prev.description || repoJson?.description || "" }))
          // Try fetching README HTML via GitHub HTML endpoint; if CORS blocked, keep null
          let readmeHtml: string | null = null
          try {
            const htmlRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/readme`, { headers: { Accept: 'application/vnd.github.html+json' } })
            if (htmlRes.ok) {
              readmeHtml = await htmlRes.text()
            }
          } catch {}
          ;(window as any).__mcp_enrich__ = {
            license: repoJson?.license?.spdx_id || repoJson?.license?.name || null,
            readme_url: readmeJson?.html_url || readmeJson?._links?.html || null,
            readme_html: readmeHtml,
            readme_last_fetched_at: new Date().toISOString(),
            maintainer_name: repoJson?.owner?.login || null,
            maintainer_url: repoJson?.owner?.html_url || null,
            maintainer_avatar_url: repoJson?.owner?.avatar_url || null,
            maintainer_followers: null,
            website_url: repoJson?.homepage || null,
          }
          try { console.debug('[validate] enrichment prepared', { hasHtml: !!readmeHtml }) } catch {}
          mentionsMcp = /\b(mcp|model\s*context\s*protocol)\b/i.test(content);
          readmeSufficient = content.trim().length >= 200; // simple length check for MVP
        }
      } catch {}
      setChecks(prev => ({ ...prev, mentionsMcp, readmeSufficient }));
      // Count: README mentions MCP
      await step();
      // Count: README length OK
      await step();

      // 3) package.json dependency check (optional but strong)
      let hasMcpDependency = false;
      try {
        const pkgRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/package.json`);
        if (pkgRes.ok) {
          const pkgJson: any = await pkgRes.json();
          if (pkgJson?.content) {
            const pkg = JSON.parse(atob(pkgJson.content));
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } as Record<string, string>;
            hasMcpDependency = Object.keys(deps).some(k => /model[- ]?context[- ]?protocol|@modelcontextprotocol\/.*/i.test(k));
          }
        }
      } catch {}
      setChecks(prev => ({ ...prev, hasMcpDependency }));
      // Count: MCP dependency present
      await step();

      const requiredOk = !!(isGithub) && !!(repoJson) && (!archived) && ((mentionsMcp) || (hasMcpDependency))
      setValidatedOk(requiredOk)
      toast({ title: "Validation complete", description: "Review the checks below before submitting." });
      return requiredOk
    } finally {
      setIsValidating(false);
      setHasValidated(true);
    }
  };

  const canSubmit = !!checks.repoExists && !!checks.isGithubUrl && (!!checks.mentionsMcp || !!checks.hasMcpDependency) && !!checks.notArchived;

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    // Require prior successful validation
    if (!hasValidated || !validatedOk || !extracted.name || !extracted.owner) {
      toast({ title: 'Validate first', description: 'Please run validation and ensure it passes before submitting.', variant: 'destructive' })
      return;
    }

    // Require GitHub sign-in for submissions (MVP rule)
    if (!isAuthenticated || !profile?.github_id) {
      toast({ title: 'GitHub required', description: 'Only GitHub accounts can submit MCP servers in the MVP.' });
      return;
    }

    // If GitHub username matches repo owner, submit immediately as owner-verified
    if (profile.github_id && extracted.owner && profile.github_id.toLowerCase() === extracted.owner.toLowerCase()) {
      try {
        await submitServer.mutateAsync({
          name: extracted.name!,
          description: extracted.description || "",
          repository_url: repoUrl.trim(),
          npm_package: undefined,
          install_command: undefined,
          tags: [],
          author: extracted.owner!,
          is_owner_verified: true,
          ...((window as any).__mcp_enrich__ || {}),
        });
        toast({ title: 'Submitted as owner', description: 'Thanks! Your server was submitted.' })
      } catch (err: any) {
        toast({ title: 'Submission failed', description: err?.message || 'Please try again later.', variant: 'destructive' })
      }
      return;
    }

    // Otherwise, start owner verification via repo topic
    try {
      // Create a pending submission to attach verification to
      const created: any = await submitServer.mutateAsync({
        name: extracted.name!,
        description: extracted.description || "",
        repository_url: repoUrl.trim(),
        npm_package: undefined,
        install_command: undefined,
        tags: [],
        author: extracted.owner!,
        ...((window as any).__mcp_enrich__ || {}),
      })
      setSubmissionId(created?.id || null)
      setNeedsOwnerProof(true)
      if (!ownerCode && extracted.name) {
        const code = verify.generateCode(extracted.name)
        await verify.setCode(created.id, code)
        setOwnerCode(code)
      }
    } catch (err: any) {
      toast({ title: 'Submission failed', description: err?.message || 'Please try again later.', variant: 'destructive' })
    }
  };

  const onGenerateOwnerCode = async () => {
    if (!submissionId || !extracted.name) return
    const code = verify.generateCode(extracted.name)
    await verify.setCode(submissionId, code)
    setOwnerCode(code)
  }

  const onVerifyOwnership = async () => {
    if (!submissionId || !extracted.owner || !extracted.repo) return
    setOwnerVerifyLoading(true)
    try {
      // Minimal public topics check
      const topicsRes = await fetch(`https://api.github.com/repos/${extracted.owner}/${extracted.repo}/topics`, { headers: { Accept: 'application/vnd.github+json' } })
      const topicsJson: any = await topicsRes.json().catch(() => ({}))
      const arr: string[] = Array.isArray(topicsJson?.names) ? topicsJson.names : []
      if (ownerCode && arr.includes(ownerCode)) {
        await verify.markVerified(submissionId)
        toast({ title: 'Ownership verified', description: 'Thanks! You can remove the topic now.' })
      } else {
        toast({ title: 'Not verified', description: 'We could not find the verification topic on the repository.', variant: 'destructive' })
      }
    } finally {
      setOwnerVerifyLoading(false)
    }
  }

  const resetValidationFlow = () => {
    // Reset all state to initial values so user can validate a new repository
    setRepoUrl("")
    setIsValidating(false)
    setCompletedChecks(0)
    setChecks({
      repoExists: null,
      isGithubUrl: null,
      mentionsMcp: null,
      hasMcpDependency: null,
      notArchived: null,
      hasLicense: null,
      readmeSufficient: null,
      recentlyUpdated: null,
      hasEnvFiles: null,
      hasEnvLocal: null,
      possibleSecrets: null,
      isInaccessible: null,
    })
    setHadExtraPath(false)
    setEnvFilesFound([])
    setHasValidated(false)
    setExtracted({})
    setOwnerCode(null)
    setOwnerVerifyLoading(false)
    setValidatedOk(false)
    setNeedsOwnerProof(false)
    setSubmissionId(null)
  }

  return (
    <main className="container py-10">
      <SEO
        title="Submit an MCP Server — Catastropic"
        description="Upload your Model Context Protocol server with images or videos and start earning."
      />
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <section>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6">Submit your MCP server</h1>
          <p className="text-muted-foreground mb-6">For the MVP, provide only the GitHub repository URL. We’ll extract details automatically and run basic quality checks.</p>
          <Card>
            <CardHeader>
              <CardTitle>Repository URL</CardTitle>
              <CardDescription>Paste a GitHub repository URL. We will validate and extract the name, author, and description.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
              <form className="space-y-5" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="repo">GitHub Repository URL</Label>
                  <Input id="repo" placeholder="https://github.com/owner/repo" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
                  {hadExtraPath && (
                    <p className="text-xs text-muted-foreground">We detected a subpath and normalized the URL to the repository root for MVP.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!validatedOk ? (
                    <Button
                      type="button"
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      disabled={isValidating || !repoUrl.trim()}
                      onClick={async () => {
                        // MVP rule: Only GitHub accounts can validate/extract
                        if (!profile?.github_id) {
                          toast({ title: 'GitHub required', description: 'Only GitHub accounts can validate & extract in the MVP.' })
                          return
                        }
                        await validateRepo()
                      }}
                    >
                      {isValidating ? "Validating…" : "Validate & Extract"}
                    </Button>
                  ) : !needsOwnerProof ? (
                    <>
                      <Button type="submit" disabled={submitServer.isPending}>
                        {submitServer.isPending ? "Submitting…" : "Submit"}
                      </Button>
                      <Button
                        type="button"
                        onClick={resetValidationFlow}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        aria-label="Validate a different repository"
                      >
                        Validate a different repo
                      </Button>
                    </>
                  ) : null}
                </div>
                {needsOwnerProof && (
                  <div className="mt-3 space-y-2">
                    <div className="text-sm font-medium">Are you the repository owner?</div>
                    {ownerCode ? (
                      <div className="space-y-1 text-sm">
                        <div>It seems that your username does not match the repository owner.</div>
                        <div>Don't worry, you can still submit your server by verifying ownership by adding the following topic to your repository:</div>
                        <div>Verification topic: <code className="text-xs bg-secondary px-1 py-0.5 rounded">{ownerCode}</code></div>
                        <div className="text-xs text-muted-foreground">Go to your repo → Settings → Topics, add the above topic, then verify below.</div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={onGenerateOwnerCode}>Regenerate code</Button>
                          <Button size="sm" onClick={onVerifyOwnership} disabled={ownerVerifyLoading}>
                            {ownerVerifyLoading ? 'Verifying…' : 'Verify ownership'}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                {/* Validation progress and summary */}
                {isValidating && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Validating… {completedChecks}/{totalChecks}</div>
                    <Progress value={(completedChecks / totalChecks) * 100} />
                  </div>
                )}
                {!isValidating && hasValidated && (() => {
                  // If inaccessible (likely private or not found), surface only that issue
                  if (checks.isInaccessible === true) {
                    return (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Issues found (1)</div>
                        <ul className="space-y-1 text-sm">
                          <li className="flex items-start justify-between gap-4">
                            <span>Repository is private or inaccessible</span>
                            <span className="text-xs text-muted-foreground">Make the repository public or grant access. We could not run other checks.</span>
                          </li>
                        </ul>
                      </div>
                    )
                  }

                  // Build failures from evaluated checks only (skip null/unknown)
                  const items = [
                    { label: 'Valid GitHub URL', ok: checks.isGithubUrl, help: 'Use https://github.com/owner/repo' },
                    { label: 'Repository exists', ok: checks.repoExists, help: 'Check URL or repo visibility' },
                    { label: 'Not archived', ok: checks.notArchived, help: 'Unarchive the repo' },
                    { label: 'License present', ok: checks.hasLicense, help: 'Add a LICENSE file' },
                    { label: 'README length ≥ 200', ok: checks.readmeSufficient, help: 'Expand README content' },
                    // Combined MCP evidence: README mention OR SDK dependency
                    { label: 'MCP evidence present (README or SDK)', ok: (checks.mentionsMcp === true || checks.hasMcpDependency === true), help: 'Mention MCP in README or add the MCP SDK dependency' },
                    { label: 'No potential secrets detected', ok: (checks.possibleSecrets === false), help: 'Remove secrets from .env files' },
                  ];
                  const failures = items.filter(x => x.ok === false);
                  const passed = items.length - failures.length;
                  return (
                    <div className="space-y-2">
                      {failures.length === 0 ? (
                        <details className="text-sm">
                          <summary className="cursor-pointer select-none">
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{passed}/{items.length} checks passed</span>
                            <span className="ml-2 text-muted-foreground">View what we validated</span>
                          </summary>
                          <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc pl-5">
                            <li>Valid GitHub URL format</li>
                            <li>Repository exists and is accessible</li>
                            <li>Not archived</li>
                            <li>License present</li>
                            <li>README length ≥ 200</li>
                            <li>MCP evidence present (README or SDK)</li>
                            <li>No potential secrets detected in .env*</li>
                          </ul>
                        </details>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Issues found ({failures.length})</div>
                          <ul className="space-y-1 text-sm">
                            {failures.map((f, i) => (
                              <li key={i} className="flex items-start justify-between gap-4">
                                <span>{f.label}</span>
                                <span className="text-xs text-muted-foreground">{f.help}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </form>
              {/* reset button moved next to Submit */}
              </div>
            </CardContent>
          </Card>
        </section>
        <aside className="bg-secondary rounded-lg p-6 border">
          <h2 className="text-xl font-semibold mb-2">Submission requirements (MVP)</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li>GitHub repo URL (public repo recommended)</li>
            <li>Repository should mention MCP in README or include an MCP SDK dependency</li>
            <li>Repository should not be archived</li>
            <li>Provide basic documentation so others can understand usage</li>
          </ul>
          <p className="text-muted-foreground mt-4 text-sm">We’ll auto-fill name, author, and description from GitHub. You can enhance details later.</p>
        </aside>
      </div>
      {/* floating reset removed */}
    </main>
  );
};

export default Submit;
