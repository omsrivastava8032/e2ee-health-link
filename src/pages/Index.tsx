import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen gradient-primary flex items-center justify-center p-4">
      <div className="max-w-4xl w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="mx-auto w-20 h-20 rounded-2xl gradient-accent flex items-center justify-center shadow-strong">
            <Activity className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
            MIoT Vitals Dashboard
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto">
            Secure, end-to-end encrypted patient vitals monitoring for healthcare professionals
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white">
            <Shield className="w-8 h-8 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">End-to-End Encrypted</h3>
            <p className="text-sm text-white/80">
              All patient data is encrypted before transmission and decrypted only on your device
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white">
            <Lock className="w-8 h-8 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">2FA Security</h3>
            <p className="text-sm text-white/80">
              Two-factor authentication ensures only authorized healthcare providers can access vitals
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white">
            <Activity className="w-8 h-8 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Real-Time Monitoring</h3>
            <p className="text-sm text-white/80">
              Monitor heart rate, SpO2, and temperature from medical IoT devices in real-time
            </p>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <Button 
            onClick={() => navigate("/auth")}
            size="lg"
            className="bg-white text-primary hover:bg-white/90 shadow-strong"
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
