import { supabase } from "./supabase";

// Function to get device info (client-side only)
export function getDeviceInfo(): { userAgent: string; ipAddress: string } {
  const userAgent = window.navigator.userAgent;
  // Note: IP address will be determined server-side
  return {
    userAgent,
    ipAddress: "", // This will be filled server-side
  };
}

// Function to verify if device is trusted
export async function isDeviceTrusted(
  userId: number,
  deviceInfo: { userAgent: string; ipAddress: string }
): Promise<boolean> {
  console.log("Checking device trust for:", {
    userId,
    deviceInfo,
  });

  const { data: user, error } = await supabase
    .from("myusers")
    .select("verified_devices")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching verified devices:", error);
    return false;
  }

  if (!user?.verified_devices) {
    console.log("No verified devices found for user");
    return false;
  }

  const verifiedDevices = user.verified_devices as Array<{
    userAgent: string;
    ipAddress: string;
  }>;

  console.log("Found verified devices:", verifiedDevices);

  // Check if any verified device matches the current one
  const isDeviceTrusted = verifiedDevices.some(
    (device) => device.userAgent === deviceInfo.userAgent
  );

  console.log("Device trust check result:", isDeviceTrusted);
  return isDeviceTrusted;
}

// Function to add device to trusted devices
export async function addTrustedDevice(
  userId: number,
  deviceInfo: { userAgent: string; ipAddress: string }
): Promise<void> {
  const { data: user } = await supabase
    .from("myusers")
    .select("verified_devices")
    .eq("id", userId)
    .single();

  const verifiedDevices =
    (user?.verified_devices as Array<{
      userAgent: string;
      ipAddress: string;
    }>) || [];

  // Add new device if it doesn't exist
  if (
    !verifiedDevices.some(
      (device) =>
        device.userAgent === deviceInfo.userAgent &&
        device.ipAddress === deviceInfo.ipAddress
    )
  ) {
    verifiedDevices.push(deviceInfo);

    await supabase
      .from("myusers")
      .update({ verified_devices: verifiedDevices })
      .eq("id", userId);
  }
}

// Function to logout and clear verified devices
export async function logout(userId: number): Promise<void> {
  try {
    await supabase
      .from("myusers")
      .update({ verified_devices: [] })
      .eq("id", userId);

    localStorage.removeItem("projectUrl");
    localStorage.removeItem("projectKey");
  } catch (error) {
    throw error;
  }
}
