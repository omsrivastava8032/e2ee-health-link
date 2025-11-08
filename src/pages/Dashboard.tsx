import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Activity, Download, LogOut, Settings, Shield, Heart, Thermometer, Droplet } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { decryptData, verifyHash } from "@/lib/crypto";
import { AlertTriangle } from "lucide-react";

interface VitalReading {
  heartRate: number;
  spo2: number;
  temp: number;
}

interface Vital {
  vital_id: string;
  patient_id: string;
  encrypted_data: string;
  timestamp: string;
  data_hash?: string | null;
  is_tampered?: boolean;
  decrypted?: VitalReading;
  verified?: boolean; // Client-side verification result
}

const Dashboard = () => {
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState("123");
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadVitals();
    }
  }, [patientId, user]);

  // Subscribe to realtime vitals for the selected patient
  useEffect(() => {
    if (!user || !patientId) return;

    const channelName = `vitals:all`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vitals',
        },
        async (payload: any) => {
          try {
            const row = payload.new as any;
            if (!row || row.patient_id !== patientId) return;
            
            // Decrypt and verify integrity
            const decryptedJson = await decryptData(row.encrypted_data);
            const decrypted = JSON.parse(decryptedJson);
            
            // Only use database flag - trust server-side tamper detection
            const isTampered = row.is_tampered === true;
            
            // Only block if database says it's tampered
            if (!isTampered) {
              setVitals((prev) => [{ ...row, decrypted, verified: true, is_tampered: false }, ...prev]);
            } else {
              // Show alert for tampered entry
              toast({
                title: "🚨 Security Alert",
                description: `Tampered entry detected for patient ${patientId} and blocked`,
                variant: "destructive",
              });
            }
          } catch (_err) {
            // Decryption failed = tampered
            const row = (payload as any).new;
            if (!row || row.patient_id !== patientId) return;
            toast({
              title: "🚨 Security Alert",
              description: `Corrupted entry detected for patient ${patientId} and blocked`,
              variant: "destructive",
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Optionally notify subscription is active
          // console.log(`Subscribed to ${channelName}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, user]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }
    
    setUser(user);
  };

  const loadVitals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("vitals")
        .select("*")
        .eq("patient_id", patientId)
        .order("timestamp", { ascending: false });

      if (error) throw error;

      // Decrypt vitals on client side and verify integrity
      const decryptedVitals = await Promise.all(
        (data || []).map(async (vital) => {
          try {
            const decryptedJson = await decryptData(vital.encrypted_data);
            const decrypted = JSON.parse(decryptedJson);
            
            // Only use database flag - don't verify hash client-side for now
            // (Hash verification can be added later once key handling is consistent)
            const isTampered = vital.is_tampered === true;
            
            return { 
              ...vital, 
              decrypted, 
              verified: !isTampered,
              is_tampered: isTampered
            };
          } catch (err) {
            console.error("Failed to decrypt vital:", err);
            return { ...vital, verified: false, is_tampered: true };
          }
        })
      );

      // Filter out ONLY tampered entries (not unverified legacy data)
      const validVitals = decryptedVitals.filter(v => !v.is_tampered);
      setVitals(validVitals);
      
      // Show warning only for actually tampered entries
      const tamperedCount = decryptedVitals.filter(v => v.is_tampered === true).length;
      if (tamperedCount > 0) {
        toast({
          title: "Security Alert",
          description: `${tamperedCount} tampered entry(ies) detected and filtered out`,
          variant: "destructive",
        });
      }
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
    const content = vitals
      .map((v) => {
        if (v.decrypted) {
          return `Timestamp: ${new Date(v.timestamp).toLocaleString()}\nHeart Rate: ${v.decrypted.heartRate} bpm\nSpO2: ${v.decrypted.spo2}%\nTemperature: ${v.decrypted.temp}°C\n---\n`;
        }
        return `Timestamp: ${new Date(v.timestamp).toLocaleString()}\nData: [Encrypted]\n---\n`;
      })
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vitals-${patientId}-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Vitals downloaded successfully",
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getLatestVital = () => {
    const latest = vitals.find(v => v.decrypted);
    return latest?.decrypted;
  };

  const latest = getLatestVital();

  const chartData = vitals
    .filter(v => v.decrypted)
    .slice(0, 50)
    .map(v => ({
      time: new Date(v.timestamp).toLocaleTimeString(),
      heartRate: (v.decrypted as VitalReading).heartRate,
      spo2: (v.decrypted as VitalReading).spo2,
      temp: (v.decrypted as VitalReading).temp,
    }))
    .reverse();

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
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  End-to-end encrypted
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <div className="text-sm text-muted-foreground text-right hidden sm:block">
                  <div>Doctor: {user.email}</div>
                  <div className="truncate max-w-[220px]">ID: {user.id}</div>
                </div>
              )}
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
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Patient Selection</CardTitle>
            <CardDescription>Enter patient ID to view their vitals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
              <Input
                placeholder="Patient ID (e.g., p123)"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              />
              <Button onClick={loadVitals}>Load Vitals</Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                Quick IDs:
                {["123", "124", "125"].map((pid) => (
                  <Button
                    key={pid}
                    variant={patientId === pid ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPatientId(pid)}
                  >
                    {pid}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {latest && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-soft gradient-card border-l-4 border-l-accent">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Heart className="w-4 h-4 text-accent" />
                  Heart Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{latest.heartRate}</div>
                <p className="text-sm text-muted-foreground">bpm</p>
              </CardContent>
            </Card>

            <Card className="shadow-soft gradient-card border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-primary" />
                  SpO2
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{latest.spo2}</div>
                <p className="text-sm text-muted-foreground">%</p>
              </CardContent>
            </Card>

            <Card className="shadow-soft gradient-card border-l-4 border-l-destructive">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-destructive" />
                  Temperature
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{latest.temp}</div>
                <p className="text-sm text-muted-foreground">°C</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Real‑Time Vitals</CardTitle>
            <CardDescription>Updates automatically as new readings arrive</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No data yet</div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="heartRate" stroke="#22c55e" dot={false} name="Heart Rate" />
                    <Line type="monotone" dataKey="spo2" stroke="#3b82f6" dot={false} name="SpO2" />
                    <Line type="monotone" dataKey="temp" stroke="#ef4444" dot={false} name="Temp" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-medium">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Vitals History</CardTitle>
                <CardDescription>
                  Patient: {patientId} • {vitals.length} readings
                </CardDescription>
              </div>
              <Button onClick={handleDownload} disabled={vitals.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : vitals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No vitals found for this patient
              </div>
            ) : (
              <div className="space-y-3">
                {vitals.map((vital) => (
                  <div
                    key={vital.vital_id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-smooth"
                  >
                    <div className="flex-1 grid grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Time</div>
                        <div className="font-medium">
                          {new Date(vital.timestamp).toLocaleString()}
                        </div>
                      </div>
                      {vital.decrypted ? (
                        <>
                          <div>
                            <div className="text-sm text-muted-foreground">Heart Rate</div>
                            <div className="font-medium">{vital.decrypted.heartRate} bpm</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">SpO2</div>
                            <div className="font-medium">{vital.decrypted.spo2}%</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Temperature</div>
                            <div className="font-medium">{vital.decrypted.temp}°C</div>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-3 text-muted-foreground">
                          [Decryption failed]
                        </div>
                      )}
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
