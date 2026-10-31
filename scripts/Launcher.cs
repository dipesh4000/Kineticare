using System;
using System.Diagnostics;
using System.IO;

class Launcher
{
    static int Main()
    {
        try
        {
            string root = AppDomain.CurrentDomain.BaseDirectory;
            if (!File.Exists(Path.Combine(root, "scripts", "launch.mjs")))
                throw new Exception("Keep this launcher in the Kineticare project root.");
            var info = new ProcessStartInfo("node", "scripts/launch.mjs");
            info.WorkingDirectory = root;
            info.UseShellExecute = false;
            using (var process = Process.Start(info))
            {
                process.WaitForExit();
                if (process.ExitCode != 0) PauseOnError();
                return process.ExitCode;
            }
        }
        catch (Exception error)
        {
            Console.Error.WriteLine("Could not start Kineticare. Install Node.js 22.12+ and run npm install in the project folder. Keep the executable beside package.json.");
            Console.Error.WriteLine(error.Message);
            PauseOnError();
            return 1;
        }
    }

    static void PauseOnError()
    {
        if (Environment.GetEnvironmentVariable("KINETICARE_NO_PAUSE") != null || Console.IsInputRedirected) return;
        Console.WriteLine("Press Enter to close.");
        Console.ReadLine();
    }
}
