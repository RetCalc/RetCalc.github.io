on run argv
	set inFile to item 1 of argv
	set outFile to item 2 of argv
	with timeout of 300 seconds
		tell application "Microsoft PowerPoint"
			activate
			open (POSIX file inFile)
			repeat 60 times
				if (count of presentations) > 0 then exit repeat
				delay 1
			end repeat
			delay 2
			set p to presentation 1
			save p in (POSIX file outFile) as save as PDF
			close p saving no
		end tell
	end timeout
end run
