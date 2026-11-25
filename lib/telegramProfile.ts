import { TelegramClient } from "telegram";
import { Api } from "telegram/tl";

export interface CompleteProfile {
  userId: number | string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  bio: string | null;
  premium: boolean | null;
  photoUrl: string | null;
}

export async function getCompleteProfile(client: TelegramClient, sessionString: string): Promise<CompleteProfile> {
  try {
    const me = await client.getMe();
    if (!me) {
      return { userId: 0, username: null, firstName: null, lastName: null, phone: null, bio: null, premium: null, photoUrl: null };
    }

    let bio: string | null = null;
    let photoUrl: string | null = null;

    try {
      const fullUser = await client.invoke(
        new Api.users.GetFullUser({
          id: me.id,
        })
      );
      if (fullUser?.fullUser) {
        bio = fullUser.fullUser.about ?? null;
        if (fullUser.fullUser.profilePhoto) {
          photoUrl = await getProfilePhotoUrl(client, fullUser.fullUser.profilePhoto);
        }
      }
    } catch (e) {
      console.warn("GetFullUser failed:", e);
    }

    return {
      userId: me.id?.valueOf?.() ?? me.id,
      username: me.username ?? null,
      firstName: me.firstName ?? null,
      lastName: me.lastName ?? null,
      phone: me.phone ?? null,
      bio,
      premium: me.premium ?? null,
      photoUrl,
    };
  } catch (e) {
    console.error("getCompleteProfile error:", e);
    return { userId: 0, username: null, firstName: null, lastName: null, phone: null, bio: null, premium: null, photoUrl: null };
  }
}

async function getProfilePhotoUrl(client: TelegramClient, photo: any): Promise<string | null> {
  try {
    if (photo?.id) {
      return `https://t.me/i/userpic/320/${photo.id}.jpg`;
    }
    return null;
  } catch {
    return null;
  }
}