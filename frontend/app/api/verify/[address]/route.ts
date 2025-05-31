import { type NextRequest, NextResponse } from "next/server"

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

export async function GET(request: NextRequest, { params }: { params: { address: string } }) {
  try {
    const address = params.address.toLowerCase()
    const verification = verifications.get(address)

    if (!verification) {
      return NextResponse.json({
        verified: false,
        walletAddress: params.address,
      })
    }

    return NextResponse.json({
      verified: verification.verified,
      walletAddress: params.address,
      anonymousId: verification.anonymousId,
      timestamp: verification.timestamp,
    })
  } catch (error) {
    console.error("Check verification error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
