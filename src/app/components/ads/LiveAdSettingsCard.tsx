"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Radio, Save } from "lucide-react";
import { adsApi, type LiveAdSettings } from "@/lib/api/ads";

const DEFAULTS: LiveAdSettings = {
  liveAdsEnabled: true,
  liveIntervalMinutes: 30,
  liveMaxPerSession: 2,
  liveSkipAfterSeconds: 5,
  liveSkipMinDurationSeconds: 12,
};

export function LiveAdSettingsCard() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<LiveAdSettings>(DEFAULTS);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ["live-ad-settings"],
    queryFn: () => adsApi.getLiveAdSettings(),
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (settings: LiveAdSettings) =>
      adsApi.updateLiveAdSettings(settings),
    onSuccess: (settings) => {
      setForm(settings);
      queryClient.invalidateQueries({ queryKey: ["live-ad-settings"] });
      setMessage("Live ad pacing saved");
      setError(null);
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to save live ad pacing");
      setMessage(null);
    },
  });

  return (
    <Card className="frosted-glass border bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-purple-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-purple-400" />
          Live TV Ad Pacing
        </CardTitle>
        <CardDescription>
          Client-side ad breaks placed at EPG boundaries. No SSAI or manifest
          stitching is used.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {queryError && (
          <Alert className="bg-red-500/10 border-red-500/30">
            <AlertDescription>
              Could not load settings; showing defaults.
            </AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert className="bg-green-500/10 border-green-500/30">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert className="bg-red-500/10 border-red-500/30">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            id="liveAdsEnabled"
            checked={form.liveAdsEnabled}
            onCheckedChange={(checked) =>
              setForm((prev) => ({
                ...prev,
                liveAdsEnabled: checked === true,
              }))
            }
          />
          <Label htmlFor="liveAdsEnabled" className="font-normal cursor-pointer">
            Enable scheduled Live TV ads
          </Label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="liveIntervalMinutes">Interval (minutes)</Label>
            <Input
              id="liveIntervalMinutes"
              type="number"
              min={5}
              max={240}
              value={form.liveIntervalMinutes}
              disabled={isLoading}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  liveIntervalMinutes: parseInt(e.target.value, 10) || 0,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Default 30. Priority is given to the next EPG program boundary
              when one falls within 5 minutes of this interval.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="liveMaxPerSession">Max per session</Label>
            <Input
              id="liveMaxPerSession"
              type="number"
              min={1}
              max={10}
              value={form.liveMaxPerSession}
              disabled={isLoading}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  liveMaxPerSession: parseInt(e.target.value, 10) || 0,
                }))
              }
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="liveSkipAfterSeconds">Skip delay (seconds)</Label>
            <Input
              id="liveSkipAfterSeconds"
              type="number"
              min={0}
              max={60}
              value={form.liveSkipAfterSeconds}
              disabled={isLoading}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  liveSkipAfterSeconds: parseInt(e.target.value, 10) || 0,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="liveSkipMinDurationSeconds">
              Allow skip only above (seconds)
            </Label>
            <Input
              id="liveSkipMinDurationSeconds"
              type="number"
              min={0}
              max={120}
              value={form.liveSkipMinDurationSeconds}
              disabled={isLoading}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  liveSkipMinDurationSeconds:
                    parseInt(e.target.value, 10) || 0,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Short ads at or below this duration are non-skippable.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending || isLoading}
          className="gap-2"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Live Pacing
        </Button>
      </CardContent>
    </Card>
  );
}
