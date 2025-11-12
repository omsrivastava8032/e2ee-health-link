import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Activity, Download, LogOut, Settings, Shield, Heart, Thermometer, Droplet, AlertTriangle } from "lucide-react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

// Interface for a single VALID vital reading
interface VitalReading {
  heartRate: number;
  spo2: number;
  temp: number;
  timestamp: string;
}

// Interface for a DETECTED security event
interface SecurityEvent {
  id: number;
  created_at: string;
  event_type: string;
  patient_id: string;
  metadata: {
    reason: string;
    data: any;
  }
}

const Dashboard = () => {
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]); // State for anomalies
  const [loading, setLoading] = useState(false);
  const [patientId, setPatientId] = useState("p123");
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    checkAuth();
    // Clean up subscription on component unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [channel]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
  };

  const handleLoadAndSubscribe = async () => {
    if (!patientId) {
      toast({ title: "Please enter a Patient ID", variant: "destructive" });
      return;
    }

    setLoading(true);
    if (channel) {
      supabase.removeChannel(channel);
      setChannel(null);
    }
    // Clear old data on new load
    setVitals([]);
    setSecurityEvents([]);

    try {
      // 1. Fetch all *valid* historical data
      const { data: existingVitals, error: vitalsError } = await supabase
        .from("vitals")
        .select("data, timestamp") // 'data' now holds plaintext JSON
        .eq("patient_id", patientId)
        .order("timestamp", { ascending: false });

      if (vitalsError) throw vitalsError;

      // 2. Fetch all *rejected* security events
      const { data: existingEvents, error: eventsError } = await supabase
        .from("security_events")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      
      if (eventsError) throw eventsError;
      setSecurityEvents(existingEvents || []);

      // 3. Process valid vitals (NO DECRYPTION NEEDED)
      const validList = (existingVitals || []).map(vital => {
        return { ...vital.data, timestamp: vital.timestamp };
      });
      setVitals(validList);

      if (validList.length === 0 && existingEvents.length === 0) {
        toast({ title: "No data found", description: "Listening for new updates..." });
      }

      // 4. Create NEW real-time subscriptions for BOTH tables
      const newChannel = supabase
        .channel(`patient-data-${patientId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "vitals", filter: `patient_id=eq.${patientId}`},
          (payload) => {
            console.log("New VALID vital received!", payload);
            const newRow = payload.new as { data: any, timestamp: string };
            const newVital: VitalReading = { ...newRow.data, timestamp: newRow.timestamp };
            setVitals((current) => [newVital, ...current]);
            toast({ title: "New Valid Vital Received!", description: `Heart Rate: ${newVital.heartRate} bpm` });
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "security_events", filter: `patient_id=eq.${patientId}`},
          (payload) => {
            console.warn("New SECURITY EVENT received!", payload);
            const newEvent = payload.new as SecurityEvent;
            setSecurityEvents((current) => [newEvent, ...current]);
            toast({
              title: "Security Attack Detected!",
              description: newEvent.metadata.reason,
              variant: "destructive",
            });
          }
        )
        .subscribe();

      setChannel(newChannel);

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    // This function will now ONLY download the VALID data
    let content = "--- VALID VITALS DATA ---\n";
    content += vitals
      .map((v) => {
        return `Timestamp: ${new Date(v.timestamp).toLocaleString()}\nHeart Rate: ${v.heartRate} bpm\nSpO2: ${v.spo2}%\nTemperature: ${v.temp}°C\n---\n`;
      })
      .join("\n");
      
    // Optionally add the detected attacks to the download
    if (securityEvents.length > 0) {
      content += "\n\n--- DETECTED SECURITY EVENTS (REJECTED) ---\n";
      content += securityEvents
        .map((event) => `Attack Type: ${event.event_type}\nTimestamp: ${new Date(event.created_at).toLocaleString()}\nReason: ${event.metadata.reason}\nData: ${JSON.stringify(event.metadata.data)}\n---\n`)
        .join("\n");
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vitals-report-${patientId}-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Vitals report downloaded successfully",
    });
  };

  const handleLogout = async () => {
    if (channel) supabase.removeChannel(channel);
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getLatestVital = () => {
    // Only shows the latest VALID vital
    return vitals.length > 0 ? vitals[0] : null;
  };

  const latest = getLatestVital();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">MIoT Vitals Dashboard</h1>
                {/* Updated description to show the "new method" */}
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Server-Side Validation Enabled
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate("/profile")}><Settings className="w-4 h-4 mr-2" />Profile</Button>
              <Button variant="outline" onClick={handleLogout}><LogOut className="w-4 h-4 mr-2" />Logout</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Patient Selection Card */}
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Patient Selection</CardTitle>
            <CardDescription>Enter patient ID to load data and subscribe to live updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input placeholder="Patient ID (e.g., p123)" value={patientId} onChange={(e) => setPatientId(e.target.value)} />
              <Button onClick={handleLoadAndSubscribe}>
                {channel ? "Refresh & Resubscribe" : "Load Vitals"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Latest Vitals Cards */}
        {latest && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-soft gradient-card border-l-4 border-l-accent">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Heart className="w-4 h-4 text-accent" />Heart Rate</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{latest.heartRate}</div><p className="text-sm text-muted-foreground">bpm</p></CardContent>
            </Card>
            <Card className="shadow-soft gradient-card border-l-4 border-l-primary">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Droplet className="w-4 h-4 text-primary" />SpO2</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{latest.spo2}</div><p className="text-sm text-muted-foreground">%</p></CardContent>
            </Card>
            <Card className="shadow-soft gradient-card border-l-4 border-l-destructive">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Thermometer className="w-4 h-4 text-destructive" />Temperature</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{latest.temp}</div><p className="text-sm text-muted-foreground">°C</p></CardContent>
            </Card>
          </div>
        )}

        {/* Real-Time Chart Card (for valid data) */}
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Real-Time Vitals Chart (Valid Data Only)</CardTitle>
            <CardDescription>
              Showing the {vitals.length > 20 ? "last 20" : vitals.length} valid readings. Malicious data is excluded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vitals.length > 0 ? (
              <div className="h-[250px] w-full">
                <ChartContainer config={{}} className="h-full w-full">
                  <AreaChart
                    data={vitals.slice(0, 20).reverse()} // Only chart VALID data
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      stroke="hsl(var(--border))"
                    />
                    <Tooltip
                      content={<ChartTooltipContent 
                        formatter={(value, name) => {
                          const unit = name === "heartRate" ? "bpm" : name === "spo2" ? "%" : "°C";
                          return `${value} ${unit}`;
                        }}
                      />}
                      cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    />
                    <Area type="monotone" dataKey="heartRate" stroke="hsl(var(--accent))" fill="hsl(var(--accent) / 0.1)" stackId="1" />
                    <Area type="monotone" dataKey="spo2" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" stackId="2" />
                    <Area type="monotone" dataKey="temp" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.1)" stackId="3" />
                  </AreaChart>
                </ChartContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {loading ? "Loading chart data..." : "No data to display in chart"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* --- THIS IS YOUR NEW SECURITY LOG --- */}
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Security & Anomaly Log</CardTitle>
            <CardDescription>
              Detected {securityEvents.length} malicious or invalid entries. These have been blocked from the main vitals table.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : securityEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No security events detected.
              </div>
            ) : (
              <div className="space-y-3">
                {securityEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-destructive/10 border-destructive/20 text-destructive"
                  >
                    <div className="flex items-center gap-4">
                      <AlertTriangle className="w-5 h-5" />
                      <div>
                        <div className="font-medium">
                          ATTACK DETECTED: {event.metadata.reason}
                        </div>
                        <div className="text-sm opacity-80" style={{ wordBreak: 'break-all' }}>
                          Timestamp: {new Date(event.created_at).toLocaleString()}
                        </div>
                        <div className="text-sm opacity-80" style={{ wordBreak: 'break-all' }}>
                          Rejected Payload: {JSON.stringify(event.metadata.data)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
