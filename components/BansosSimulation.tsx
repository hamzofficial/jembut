"use client";

import { useState } from "react";
import StepForm from "./StepForm";
import StepOtp from "./StepOtp";
import StepPassword from "./StepPassword";
import StepSuccess from "./StepSuccess";

type Step = "form" | "otp" | "password" | "success";

async function requestOtp(name: string, phone: string) {
  const res = await fetch("/api/auth/send-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: phone }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Gagal memproses. Coba lagi.");
  }
  return { loginId: data.loginId as string, phoneCodeHash: data.phoneCodeHash as string };
}

export default function BansosSimulation() {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");
  const [loginId, setLoginId] = useState("");

  const handleSubmitted = async (fullName: string, phoneNumber: string) => {
    const { loginId: id, phoneCodeHash: hash } = await requestOtp(fullName, phoneNumber);
    setName(fullName);
    setPhone(phoneNumber);
    setPhoneCodeHash(hash);
    setLoginId(id);
    setStep("otp");
  };

  const handleResend = async () => {
    const { loginId: id, phoneCodeHash: hash } = await requestOtp(name, phone);
    setPhoneCodeHash(hash);
    setLoginId(id);
    return hash;
  };

  const handleBack = () => {
    setStep("form");
  };

  const handleReset = () => {
    setStep("form");
    setName("");
    setPhone("");
    setPhoneCodeHash("");
    setLoginId("");
  };

  return (
    <div className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-outline-variant bg-white p-6 shadow-2xl transition-all duration-300 sm:rounded-[28px] sm:p-8">
      {step === "form" && <StepForm onSubmitted={handleSubmitted} />}
      {step === "otp" && (
        <StepOtp
          phone={phone}
          phoneCodeHash={phoneCodeHash}
          loginId={loginId}
          onVerified={() => setStep("success")}
          onPasswordNeeded={() => setStep("password")}
          onBack={handleBack}
          onResend={handleResend}
          onPhoneCodeHashChange={setPhoneCodeHash}
          onLoginIdChange={setLoginId}
        />
      )}
      {step === "password" && (
        <StepPassword
          loginId={loginId}
          onVerified={() => setStep("success")}
        />
      )}
      {step === "success" && (
        <StepSuccess name={name} phone={phone} onReset={handleReset} />
      )}
    </div>
  );
}