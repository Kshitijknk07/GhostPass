import { type NextRequest, NextResponse } from "next/server"
import { ethers } from "ethers"

// In-memory storage for demo (use a database in production)
const verifications = new Map<
  string,
  {
    verified: boolean
    timestamp: string
    anonymousId: string
    signature: string
  }
>()

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, signature, message } = await request.json()

    if (!walletAddress || !signature || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify the signature
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature)

      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
      }
    } catch (error) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 400 })
    }

    // Generate anonymous ID
    const anonymousId = `dark_${Math.random().toString(36).substr(2, 9)}`

    // Store verification
    verifications.set(walletAddress.toLowerCase(), {
      verified: true,
      timestamp: new Date().toISOString(),
      anonymousId,
      signature,
    })

    return NextResponse.json({
      success: true,
      anonymousId,
      verified: true,
    })
  } catch (error) {
    console.error("Verification error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
