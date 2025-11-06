import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, ArrowLeft, Check } from "lucide-react";
import { generateTOTPSecret, generateQRCodeURL, verifyTOTP } from "@/lib/totp";

const Profile = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [totpSecret, setTotpSecret] = useState("");
  const [qrCodeURL, setQrCodeURL] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);
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

  const handleEnable2FA = () => {
    const secret = generateTOTPSecret();
    setTotpSecret(secret);
    setQrCodeURL(generateQRCodeURL(secret, profile.email));
    setShowSetup(true);
  };

  const handleVerifyAndEnable = async () => {
    try {
      const isValid = await verifyTOTP(verificationCode, totpSecret);
      
      if (!isValid) {
        throw new Error("Invalid verification code");
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          is_2fa_enabled: true,
          totp_secret: totpSecret,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Two-factor authentication enabled",
      });

      setShowSetup(false);
      loadProfile();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDisable2FA = async () => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_2fa_enabled: false,
          totp_secret: null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Two-factor authentication disabled",
      });

      loadProfile();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Security Settings
            </CardTitle>
            <CardDescription>Manage your account security preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <div className="font-medium">Two-Factor Authentication</div>
                <div className="text-sm text-muted-foreground">
                  Status: {profile?.is_2fa_enabled ? (
                    <span className="text-accent font-semibold flex items-center gap-1 inline-flex">
                      <Check className="w-4 h-4" /> Enabled
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Disabled</span>
                  )}
                </div>
              </div>
              {!profile?.is_2fa_enabled ? (
                <Button onClick={handleEnable2FA}>Enable 2FA</Button>
              ) : (
                <Button variant="destructive" onClick={handleDisable2FA}>
                  Disable 2FA
                </Button>
              )}
            </div>

            {showSetup && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <h3 className="font-semibold">Setup Two-Factor Authentication</h3>
                  <p className="text-sm text-muted-foreground">
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                  </p>
                </div>
                
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img src={qrCodeURL} alt="2FA QR Code" className="w-48 h-48" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-code">Or enter this code manually:</Label>
                  <Input
                    id="manual-code"
                    value={totpSecret}
                    readOnly
                    className="font-mono text-center"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="verification">Enter verification code to confirm:</Label>
                  <Input
                    id="verification"
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl tracking-widest"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleVerifyAndEnable}
                    disabled={verificationCode.length !== 6}
                    className="flex-1"
                  >
                    Verify and Enable
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowSetup(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
