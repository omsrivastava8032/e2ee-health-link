import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Activity, Download, LogOut, Settings, Shield, Heart, Thermometer, Droplet, AlertTriangle } from "lucide-react";
import { decryptData } from "@/lib/crypto";
import { RealtimeChannel } from "@supabase/supabase-js";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

// Interface for a single decrypted vital reading
interface VitalReading {
  heartRate: number;
  spo2: number;
  temp: number;
}

// Interface for the data we'll store in our state (with timestamp)
interface DecryptedVital extends VitalReading {
  timestamp: string;
}

// Interface for a vital that failed decryption (malicious)
interface FailedVital {
  vital_id: string;
  timestamp: string;
  error: string;
  encrypted_data: string;
}

const Dashboard = () => {
  // This holds the GOOD data
  const [vitals, setVitals] = useState<DecryptedVital[]>([]);
  // This holds the MALICIOUS data
  const [failedVitals, setFailedVitals] = useState<FailedVital[]>([]);
  
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

  // This function logs the attack to your new 'security_events' table
  const logSecurityEvent = async (eventType: string, patientId: string, metadata: any) => {
    if (!user) return; // Don't log if user isn't loaded
    try {
      const { error } = await supabase.from("security_events").insert({
        event_type: eventType, // This will now be "Modification of Messages"
        patient_id: patientId,
        metadata: metadata,
        user_id: user.id, // Link to the user who detected it
      });
      if (error) {
        console.error("Error logging security event:", error);
      } else {
        console.warn(`Security event logged: ${eventType}`);
        toast({
          title: "Security Alert!",
          description: `Detected Attack: ${eventType}`,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Failed to log security event:", err);
    }
  };

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
    setFailedVitals([]);

    try {
      // 1. Fetch all historical data for this patient
      const { data: existingVitals, error } = await supabase
        .from("vitals")
        .select("vital_id, encrypted_data, timestamp, patient_id")
        .eq("patient_id", patientId)
        .order("timestamp", { ascending: false });

      if (error) throw error;

      const decryptedList: DecryptedVital[] = [];
      const failedList: FailedVital[] = [];

      // 2. Process historical data
      await Promise.all(
        (existingVitals || []).map(async (vital) => {
          try {
            // --- THIS IS THE DEFENSE ---
            const decryptedJson = await decryptData(vital.encrypted_data);
            const data = JSON.parse(decryptedJson);
            decryptedList.push({ ...data, timestamp: vital.timestamp });
          } catch (err) {
            // --- THIS IS THE DETECTION ---
            console.error("Failed to decrypt vital:", err);
            failedList.push({ ...vital, error: (err as Error).message, encrypted_data: vital.encrypted_data });
            // Log the attack with your new text
            await logSecurityEvent("Modification of Messages", vital.patient_id, {
              reason: "Data integrity-violated",
              vital_id: vital.vital_id,
              timestamp: vital.timestamp,
              tampered_data: vital.encrypted_data
            });
            // --------------------------
          }
        })
      );

      setVitals(decryptedList);
      setFailedVitals(failedList);

      if (decryptedList.length === 0 && failedList.length === 0) {
        toast({
          title: "No data found",
          description: "Listening for new vitals for this patient...",
        });
      }

      // 3. Subscribe to real-time updates
      const newChannel = supabase
        .channel(`vitals-for-${patientId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "vitals",
            filter: `patient_id=eq.${patientId}`,
          },
          async (payload) => {
            console.log("New vital received!", payload);
            
            const newRow = payload.new as {
              vital_id: string;
              encrypted_data: string;
              timestamp: string;
              patient_id: string;
            };

            try {
              // --- REAL-TIME DEFENSE ---
              const decryptedJson = await decryptData(newRow.encrypted_data);
              const data = JSON.parse(decryptedJson);
              const newVital: DecryptedVital = {
                ...data,
                timestamp: newRow.timestamp,
              };
              // It's valid. Add to VALID list.
              setVitals((currentVitals) => [newVital, ...currentVitals]);
              toast({
                title: "New Vital Received!",
                description: `Heart Rate: ${newVital.heartRate} bpm`,
              });
            } catch (err) {
              // --- REAL-TIME DETECTION ---
              console.error("Failed to decrypt real-time vital:", err);
              const newFailedVital: FailedVital = { ...newRow, error: (err as Error).message, encrypted_data: newRow.encrypted_data };
              setFailedVitals((currentFailed) => [newFailedVital, ...currentFailed]);
              // Log the attack with your new text
              await logSecurityEvent("Modification of Messages", newRow.patient_id, {
                reason: "Data integrity-violated",
                vital_id: newRow.vital_id,
                timestamp: newRow.timestamp,
                tampered_data: newRow.encrypted_data
              });
              // --------------------------
            }
          }
        )
        .subscribe();

      setChannel(newChannel);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
    if (failedVitals.length > 0) {
      content += "\n\n--- DETECTED MALICIOUS ENTRIES (REJECTED) ---\n";
      content += failedVitals
        .map((v) => `Attack Type: Modification of Messages\nTimestamp: ${new Date(v.timestamp).toLocaleString()}\nReason: Data integrity-violated\nTampered Data: ${v.encrypted_data}\n---\n`)
        .join("\n");
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vitals-${patientId}-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Vitals report downloaded successfully",
    });
  };

  const handleLogout = async () => {
    if (channel) {
      supabase.removeChannel(channel);
    }
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
      {/* Header remains the same */}
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">MIoT Vitals Dashboard</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  End-to-end encrypted
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate("/profile")}>
                <Settings className="w-4 h-4 mr-2" />
                Profile
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Patient Selection Card remains the same */}
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Patient Selection</CardTitle>
            <CardDescription>Enter patient ID to load data and subscribe to live updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Patient ID (e.g., p123)"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              />
              <Button onClick={handleLoadAndSubscribe}>
                {channel ? "Refresh & Resubscribe" : "Load Vitals"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Latest Vitals Cards remain the same */}
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

        {/* Real-Time Chart Card remains the same */}
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

        {/* --- 
          UPDATED VITALS HISTORY CARD 
          This is where your requested changes are.
        --- */}
        <Card className="shadow-medium">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Vitals History & Security Log</CardTitle>
                <CardDescription>
                  Patient: {patientId} • {vitals.length} valid readings • {failedVitals.length} malicious entries detected
                </CardDescription>
              </div>
              <Button onClick={handleDownload} disabled={vitals.length === 0 && failedVitals.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : vitals.length === 0 && failedVitals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No vitals found for this patient
              </div>
            ) : (
              <div className="space-y-3">
                
                {/* --- THIS IS THE DISPLAY FOR YOUR MALICIOUS DATA --- */}
                {failedVitals.map((vital) => (
                  <div
                    key={vital.vital_id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-destructive/10 border-destructive/20 text-destructive"
                  >
                    <div className="flex items-center gap-4">
                      <AlertTriangle className="w-5 h-5" />
                      <div>
                        {/* --- YOUR REQUESTED TEXT --- */}
                        <div className="font-medium">
                          Attack Type: Modification of Messages
                        </div>
                        <div className="text-sm opacity-80" style={{ wordBreak: 'break-all' }}>
                          Reason: Data integrity-violated
                        </div>
                        <div className="text-sm opacity-80" style={{ wordBreak: 'break-all' }}>
                          Timestamp: {new Date(vital.timestamp).toLocaleString()}
                        </div>
                        <div className="text-sm opacity-80" style={{ wordBreak: 'break-all' }}>
                          Tampered Data: {vital.encrypted_data}
                        </div>
                        {/* --------------------------- */}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* This section ONLY shows valid data */}
                {vitals.map((vital, index) => (
                  <div
                    key={`${vital.timestamp}-${index}`}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-smooth"
                  >
                    <div className="flex-1 grid grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Time</div>
                        <div className="font-medium">
                          {new Date(vital.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Heart Rate</div>
                        <div className="font-medium">{vital.heartRate} bpm</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">SpO2</div>
                        <div className="font-medium">{vital.spo2}%</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Temperature</div>
                        <div className="font-medium">{vital.temp}°C</div>
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
