import Link from "next/link";

export default function PendingPage() {
  return (
    <div className="bg-[#F4F4F0] min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md flex flex-col gap-6">
        <span className="text-2xl font-semibold">FERMENT</span>
        <h1 className="text-4xl font-medium">Your application is under review.</h1>
        <p className="text-base text-gray-600">
          We have received your application and will review it shortly.
          You will receive an email once your shop has been approved.
        </p>
        <Link href="/" className="text-sm underline text-gray-500">
          Return to marketplace
        </Link>
      </div>
    </div>
  );
}
